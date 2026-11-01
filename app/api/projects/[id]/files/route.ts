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
    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length > 100) return NextResponse.json({ error: "A project can contain up to 100 text files." }, { status: 400 });
    let saved = 0;
    for (const file of files) {
      const path = String(file.path || "");
      const content = String(file.content ?? "");
      if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]{0,239}$/.test(path) || path.split("/").some((s:string)=>!s || s==="." || s===".." || s.startsWith("."))) continue;
      const bytes = Buffer.byteLength(content, "utf8");
      if (bytes > 1024 * 1024) return NextResponse.json({ error: path + " exceeds the 1 MB text-file limit." }, { status: 413 });
      await sql`INSERT INTO project_files (project_id, path, content, byte_size, is_binary)
        VALUES (${params.id}::uuid, ${path}, ${content}, ${bytes}, FALSE)
        ON CONFLICT (project_id, path) DO UPDATE SET content=EXCLUDED.content, storage_key=NULL, mime_type=NULL, byte_size=EXCLUDED.byte_size, is_binary=FALSE`;
      saved++;
    }
    await sql`UPDATE projects SET updated_at=NOW() WHERE id=${params.id}::uuid`;
    return NextResponse.json({ saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save project files." }, { status: 400 });
  }
}
