import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SOURCE_BYTES = 200 * 1024;
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const COMPILE_TIMEOUT_MS = 35_000;

function runTectonic(cwd: string, outputDir: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve, reject) => {
    const binary = process.env.TECTONIC_BIN || "tectonic";
    const child = spawn(binary, [
      "-X", "compile",
      "--outdir", outputDir,
      "--keep-logs",
      "--keep-intermediates",
      "main.tex"
    ], {
      cwd,
      env: { ...process.env, HOME: cwd, XDG_CACHE_HOME: path.join(cwd, ".cache") },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill("SIGKILL");
        settled = true;
        resolve({ code: null, stdout, stderr: stderr + "\nCompilation timed out.", timedOut: true });
      }
    }, COMPILE_TIMEOUT_MS);

    child.stdout.on("data", chunk => { stdout = (stdout + chunk.toString()).slice(-16_000); });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-24_000); });
    child.on("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut: false });
    });
  });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const source = (payload as { source?: unknown } | null)?.source;
  if (typeof source !== "string" || !source.trim()) {
    return NextResponse.json({ error: "Provide non-empty LaTeX source in the 'source' field." }, { status: 400 });
  }
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: "The current compiler limit is 200 KB of LaTeX source." }, { status: 413 });
  }

  // A per-request temporary workspace prevents concurrent builds from sharing files.
  const workspace = await mkdtemp(path.join(os.tmpdir(), "ors-tex-"));
  const outputDir = path.join(workspace, "output");
  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(workspace, "main.tex"), source, { encoding: "utf8", flag: "wx" });

    let result;
    try {
      result = await runTectonic(workspace, outputDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start Tectonic.";
      if (message.includes("ENOENT")) {
        return NextResponse.json({
          error: "Tectonic is not installed on this server.",
          details: "Install Tectonic or deploy this application using the provided Dockerfile."
        }, { status: 503 });
      }
      return NextResponse.json({ error: "Could not start the LaTeX compiler.", details: message }, { status: 500 });
    }

    if (result.timedOut) {
      return NextResponse.json({ error: "Compilation timed out after 35 seconds.", logs: result.stderr }, { status: 408 });
    }
    if (result.code !== 0) {
      return NextResponse.json({
        error: "LaTeX compilation failed. Check the compiler output.",
        logs: (result.stderr + "\n" + result.stdout).trim().slice(-12_000)
      }, { status: 422 });
    }

    const pdfPath = path.join(outputDir, "main.pdf");
    let pdfStat;
    try {
      pdfStat = await stat(pdfPath);
    } catch {
      return NextResponse.json({ error: "Tectonic finished but did not produce main.pdf.", logs: result.stderr }, { status: 500 });
    }
    if (pdfStat.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "The generated PDF exceeds the 12 MB response limit." }, { status: 413 });
    }

    const pdf = await readFile(pdfPath);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="main.pdf"',
        "Cache-Control": "no-store",
        "X-Compiler": "Tectonic"
      }
    });
  } finally {
    // Remove sources, generated artifacts, and any downloaded TeX cache after each build.
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
