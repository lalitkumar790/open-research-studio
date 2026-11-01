import "server-only";
import { neon } from "@neondatabase/serverless";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createRemoteJWKSet, jwtVerify } from "jose";

const databaseUrl = process.env.DATABASE_URL;
const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
const jwksUrl = process.env.NEON_AUTH_JWKS_URL || "";
const bucket = process.env.NEON_STORAGE_BUCKET || "uploads";

if (!databaseUrl || !authBaseUrl || !jwksUrl) {
  // Keep build-time imports safe; requests fail closed in getStorageContext().
}

const sql = databaseUrl ? neon(databaseUrl) : null;
const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: true,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
    : undefined,
});

export type StorageUser = { id: string; neonAuthId: string; email: string };

export async function getStorageContext(request: Request): Promise<{ user: StorageUser } | { error: string; status: number }> {
  if (!sql || !jwks || !authBaseUrl) {
    return { error: "Cloud storage is not configured for this deployment.", status: 503 };
  }
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: "Sign in is required.", status: 401 };

  try {
    const { payload } = await jwtVerify(match[1], jwks);
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    const issuer = typeof payload.iss === "string" ? payload.iss : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject) ||
        !email || !issuer || new URL(issuer).host !== new URL(authBaseUrl).host) {
      return { error: "The sign-in token is missing required identity claims.", status: 401 };
    }
    const rows = await sql`
      INSERT INTO users (neon_auth_user_id, email)
      VALUES (${subject}::uuid, ${email})
      ON CONFLICT (neon_auth_user_id)
      DO UPDATE SET email = EXCLUDED.email
      RETURNING id::text AS id
    `;
    if (!rows[0]?.id) return { error: "Could not resolve the signed-in account.", status: 401 };
    return { user: { id: String(rows[0].id), neonAuthId: subject, email } };
  } catch {
    return { error: "Your session is invalid or expired. Please sign in again.", status: 401 };
  }
}

export async function canAccessProject(userId: string, projectId: string, write = false) {
  if (!sql) return false;
  const rows = await sql`
    SELECT 1
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ${userId}::uuid
    WHERE p.id = ${projectId}::uuid AND p.deleted_at IS NULL
      AND (p.owner_id = ${userId}::uuid OR (pm.user_id IS NOT NULL AND (NOT ${write}::boolean OR pm.role IN ('owner','editor'))))
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function createUploadUrl(input: {
  userId: string; projectId: string; path: string; contentType: string; byteSize: number;
}) {
  if (!sql) throw new Error("Database is unavailable.");
  const safePath = input.path.replace(/\\/g, "/");
  const segments = safePath.split("/");
  if (!safePath || safePath.length > 240 || safePath.startsWith("/") ||
      segments.some(part => !part || part === "." || part === ".." || part.startsWith(".") ||
        !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part))) {
    throw new Error("Choose a valid relative file path.");
  }
  if (!Number.isInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > 10 * 1024 * 1024) {
    throw new Error("Files must be between 1 byte and 10 MB.");
  }
  const allowed = new Set(["image/png","image/jpeg","application/pdf","application/octet-stream"]);
  if (!allowed.has(input.contentType)) throw new Error("This file type is not supported for cloud storage.");

  const fileId = crypto.randomUUID();
  const key = `${input.userId}/${input.projectId}/${fileId}`;
  const inserted = await sql`
    INSERT INTO project_files (id, project_id, path, storage_key, mime_type, byte_size, is_binary)
    VALUES (${fileId}::uuid, ${input.projectId}::uuid, ${safePath}, ${key}, ${input.contentType}, ${input.byteSize}, TRUE)
    ON CONFLICT (project_id, path)
    DO UPDATE SET id = EXCLUDED.id, storage_key = EXCLUDED.storage_key, mime_type = EXCLUDED.mime_type,
      byte_size = EXCLUDED.byte_size, is_binary = TRUE, content = NULL
    RETURNING id::text AS id
  `;
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType });
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });
  return { url, fileId: String(inserted[0].id), objectKey: key, expiresIn: 300 };
}

export async function createDownloadUrl(userId: string, projectId: string, fileId: string) {
  if (!sql) throw new Error("Database is unavailable.");
  const rows = await sql`
    SELECT storage_key, path, mime_type
    FROM project_files
    WHERE id = ${fileId}::uuid AND project_id = ${projectId}::uuid AND is_binary = TRUE
    LIMIT 1
  `;
  const file = rows[0];
  if (!file?.storage_key || String(file.storage_key).split("/")[1] !== projectId) {
    throw new Error("File not found.");
  }
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: String(file.storage_key),
    ResponseContentType: String(file.mime_type || "application/octet-stream"),
    ResponseContentDisposition: `attachment; filename="${String(file.path).split("/").pop()?.replace(/["\\\\]/g, "") || "download"}"`,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 120 });
  return { url, path: String(file.path), expiresIn: 120 };
}

export async function deleteProjectAssets(userId: string, projectId: string) {
  if (!sql) throw new Error("Database is unavailable.");
  const rows = await sql`SELECT storage_key FROM project_files WHERE project_id=${projectId}::uuid AND is_binary=TRUE`;
  for (const row of rows) {
    const key = String(row.storage_key || "");
    if (!key || key.split("/")[0] !== userId || key.split("/")[1] !== projectId) {
      throw new Error("A project asset failed its ownership check.");
    }
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}

export async function verifyUploadedObject(userId: string, projectId: string, fileId: string) {
  if (!sql) throw new Error("Database is unavailable.");
  const rows = await sql`
    SELECT storage_key FROM project_files
    WHERE id = ${fileId}::uuid AND project_id = ${projectId}::uuid LIMIT 1
  `;
  const key = rows[0]?.storage_key;
  if (!key || !String(key).startsWith(`${userId}/${projectId}/`)) throw new Error("File not found.");
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: String(key) }));
  const size = Number(head.ContentLength || 0);
  if (!size || size > 10 * 1024 * 1024) throw new Error("Uploaded file is empty or exceeds 10 MB.");
  await sql`UPDATE project_files SET byte_size = ${size} WHERE id = ${fileId}::uuid`;
  return { fileId, byteSize: size };
}
