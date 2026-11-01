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
  const [projects, files] = await Promise.all([
    sql`SELECT id::text AS id, name, created_at AS "createdAt", updated_at AS "updatedAt" FROM projects WHERE id=${params.id}::uuid AND deleted_at IS NULL LIMIT 1`,
    sql`SELECT id::text AS id, path, content, mime_type AS "mimeType", byte_size AS "byteSize", is_binary AS "isBinary" FROM project_files WHERE project_id=${params.id}::uuid ORDER BY path`
  ]);
  if (!projects[0]) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ project: projects[0], files }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const context = await getStorageContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  if (!uuid.test(params.id)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
  if (!await canAccessProject(context.user.id, params.id, true)) return NextResponse.json({ error: "Project not found or read-only." }, { status: 404 });
  if (!sql) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const body = await request.json();
  const name = String(body.name || "").trim().slice(0, 160);
  if (!name) return NextResponse.json({ error: "Project name cannot be empty." }, { status: 400 });
  const rows = await sql`UPDATE projects SET name=${name} WHERE id=${params.id}::uuid AND deleted_at IS NULL RETURNING id::text AS id, name, updated_at AS "updatedAt"`;
  return NextResponse.json({ project: rows[0] }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const context = await getStorageContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  if (!uuid.test(params.id)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
  if (!sql) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const rows = await sql`UPDATE projects SET deleted_at=NOW() WHERE id=${params.id}::uuid AND owner_id=${context.user.id}::uuid AND deleted_at IS NULL RETURNING id`;
  if (!rows.length) return NextResponse.json({ error: "Only the project owner can delete this project." }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
