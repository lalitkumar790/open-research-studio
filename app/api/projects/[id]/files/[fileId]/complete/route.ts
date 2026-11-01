import { NextRequest, NextResponse } from "next/server";
import { canAccessProject, getStorageContext, verifyUploadedObject } from "@/lib/server/storage";

export const runtime = "nodejs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: { id: string; fileId: string } }) {
  const context = await getStorageContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  if (!uuid.test(params.id) || !uuid.test(params.fileId)) {
    return NextResponse.json({ error: "Invalid project or file ID." }, { status: 400 });
  }
  if (!await canAccessProject(context.user.id, params.id, true)) {
    return NextResponse.json({ error: "You do not have permission to update this project." }, { status: 403 });
  }
  try {
    const result = await verifyUploadedObject(context.user.id, params.id, params.fileId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not verify uploaded file." }, { status: 400 });
  }
}
