import { NextRequest, NextResponse } from "next/server";
import { getStorageContext } from "@/lib/server/storage";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export async function GET(request: NextRequest) {
  const context = await getStorageContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  if (!sql) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const rows = await sql`
    SELECT p.id::text AS id, p.name, p.created_at AS "createdAt", p.updated_at AS "updatedAt",
      p.owner_id = ${context.user.id}::uuid AS owned,
      COALESCE(pm.role, 'owner') AS role
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ${context.user.id}::uuid
    WHERE p.deleted_at IS NULL
      AND (p.owner_id = ${context.user.id}::uuid OR pm.user_id IS NOT NULL)
    ORDER BY p.updated_at DESC
  `;
  return NextResponse.json({ projects: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const context = await getStorageContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  if (!sql) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  try {
    const body = await request.json();
    const name = String(body.name || "Untitled Project").trim().slice(0, 160) || "Untitled Project";
    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length > 100) return NextResponse.json({ error: "A project can contain up to 100 text files at creation." }, { status: 400 });
    const rows = await sql`
      INSERT INTO projects (owner_id, name) VALUES (${context.user.id}::uuid, ${name})
      RETURNING id::text AS id, name, created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    const project = rows[0];
    await sql`INSERT INTO project_members (project_id, user_id, role)
      VALUES (${project.id}::uuid, ${context.user.id}::uuid, 'owner')
      ON CONFLICT (project_id, user_id) DO NOTHING`;
    for (const file of files) {
      const path = String(file.path || "");
      const content = String(file.content || "");
      if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]{0,239}$/.test(path) || path.split("/").some((s:string)=>!s || s==="." || s===".." || s.startsWith("."))) continue;
      if (Buffer.byteLength(content, "utf8") > 1024 * 1024) continue;
      await sql`INSERT INTO project_files (project_id, path, content, byte_size)
        VALUES (${project.id}::uuid, ${path}, ${content}, ${Buffer.byteLength(content, "utf8")})
        ON CONFLICT (project_id, path) DO UPDATE SET content=EXCLUDED.content, storage_key=NULL, is_binary=FALSE, byte_size=EXCLUDED.byte_size`;
    }
    return NextResponse.json({ project }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create project." }, { status: 400 });
  }
}
