import { NextRequest, NextResponse } from "next/server";
import { canAccessProject, getStorageContext } from "@/lib/server/storage";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const context = await getStorageContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  if (!uuid.test(params.id)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
  if (!await canAccessProject(context.user.id, params.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (!sql) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const files = await sql`SELECT id::text AS id, path, content, mime_type AS "mimeType", byte_size AS "byteSize", is_binary AS "isBinary" FROM project_files WHERE project_id=${params.id}::uuid ORDER BY path`;
  return NextResponse.json({ files }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const context = await getStorageContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  if (!uuid.test(params.id)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
  if (!await canAccessProject(context.user.id, params.id, true)) return NextResponse.json({ error: "Project not found or read-only." }, { status: 404 });
  if (!sql) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  try {
    const body = await request.json();
    if (!Array.isArray(body.files)) {
      return NextResponse.json({ error: "The files field must be an array." }, { status: 400 });
    }
    const files = body.files as Array<{ path?: unknown; content?: unknown }>;
    if (files.length > 100) return NextResponse.json({ error: "A project can contain up to 100 text files." }, { status: 400 });

    // Validate the complete snapshot before writing anything. This prevents a malformed
    // later entry from leaving the project only partially updated.
    const validated: Array<{ path: string; content: string; bytes: number }> = [];
    const seen = new Set<string>();
    let totalBytes = 0;
    for (const file of files) {
      if (!file || typeof file !== "object" || typeof file.path !== "string" || typeof file.content !== "string") {
        return NextResponse.json({ error: "Each file must include a string path and string content." }, { status: 400 });
      }
      const path = file.path;
      if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]{0,239}$/.test(path) || path.split("/").some((part:string)=>!part || part==="." || part===".." || part.startsWith("."))) {
        return NextResponse.json({ error: "Invalid project file path: " + path }, { status: 400 });
      }
      if (seen.has(path)) return NextResponse.json({ error: "Duplicate project file path: " + path }, { status: 400 });
      seen.add(path);
      const bytes = Buffer.byteLength(file.content, "utf8");
      if (bytes > 1024 * 1024) return NextResponse.json({ error: path + " exceeds the 1 MB text-file limit." }, { status: 413 });
      totalBytes += bytes;
      if (totalBytes > 2.5 * 1024 * 1024) return NextResponse.json({ error: "The total text content exceeds the 2.5 MB project limit." }, { status: 413 });
      validated.push({ path, content: file.content, bytes });
    }

    let saved = 0;
    for (const file of validated) {
      await sql`INSERT INTO project_files (project_id, path, content, byte_size, is_binary)
        VALUES (${params.id}::uuid, ${file.path}, ${file.content}, ${file.bytes}, FALSE)
        ON CONFLICT (project_id, path) DO UPDATE SET content=EXCLUDED.content, storage_key=NULL, mime_type=NULL, byte_size=EXCLUDED.byte_size, is_binary=FALSE`;
      saved++;
    }

    // Autosave marks its payload as a complete text-file snapshot. Delete omitted text
    // files only after every upsert succeeds, and never touch binary assets.
    if (body.replaceTextFiles === true) {
      const paths = JSON.stringify(validated.map(file => file.path));
      await sql`DELETE FROM project_files
        WHERE project_id=${params.id}::uuid
          AND is_binary=FALSE
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(${paths}::jsonb) AS desired(path)
            WHERE desired.path = project_files.path
          )`;
    }

    await sql`UPDATE projects SET updated_at=NOW() WHERE id=${params.id}::uuid`;
    return NextResponse.json({ saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save project files." }, { status: 400 });
  }
}
