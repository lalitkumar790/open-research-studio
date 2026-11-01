import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROJECT_BYTES = 2.5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const COMPILE_TIMEOUT_MS = 35_000;
const MAX_CONCURRENT_COMPILES = 2;
let activeCompiles = 0;

type CompilePayload = { source?: unknown; files?: unknown; entryFile?: unknown };

function validatePayload(payload: unknown) {
  const body = payload as CompilePayload | null;
  const source = body?.source;
  const entryFile = typeof body?.entryFile === "string" ? body.entryFile : "main.tex";
  const entrySegments = entryFile.replace(/\\\\/g, "/").split("/");
  const safeEntry = entryFile.endsWith(".tex") && !entryFile.startsWith("/") && entrySegments.every(segment => segment && segment !== "." && segment !== ".." && /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(segment) && !segment.startsWith("."));
  const files = body?.files && typeof body.files === "object" && !Array.isArray(body.files)
    ? body.files as Record<string, unknown>
    : {};
  if (!safeEntry) return { error: "The selected entry file must be a safe relative .tex path.", status: 400 as const };
  if (typeof source !== "string" || !source.trim()) {
    return { error: "Provide non-empty LaTeX source in the 'source' field.", status: 400 as const };
  }
  const entries = Object.entries(files);
  if (entries.length > 40) return { error: "A project can include at most 40 supporting files.", status: 413 as const };
  let totalBytes = Buffer.byteLength(source, "utf8");
  for (const [name, value] of entries) {
    const normalized = name.replace(/\\/g, "/");
    const segments = normalized.split("/");
    const extension = segments.at(-1)?.split(".").pop()?.toLowerCase();
    const safePath = normalized === name && !normalized.startsWith("/") &&
      segments.every(segment => segment && segment !== "." && segment !== ".." && /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(segment)) &&
      !segments.some(segment => segment.startsWith("."));
    const supported = ["tex", "bib", "txt", "sty", "cls", "png", "jpg", "jpeg", "pdf"];
    if (!safePath || !extension || !supported.includes(extension) || typeof value !== "string") {
      return { error: "Files must use safe relative paths and supported .tex, .bib, .sty, .cls, .txt, .png, .jpg, .jpeg or .pdf extensions.", status: 400 as const };
    }
    let bytes = Buffer.byteLength(value, "utf8");
    if (/^data:(image\/(png|jpeg)|application\/pdf);base64,/.test(value)) {
      const encoded = value.slice(value.indexOf(",") + 1);
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return { error: "Invalid image encoding for " + name + ".", status: 400 as const };
      bytes = Buffer.from(encoded, "base64").byteLength;
      if (!["png", "jpg", "jpeg", "pdf"].includes(extension)) return { error: "Binary data is not allowed for " + name + ".", status: 400 as const };
    } else if (["png", "jpg", "jpeg", "pdf"].includes(extension)) {
      return { error: "Upload " + name + " as a supported binary asset.", status: 400 as const };
    }
    if (bytes > MAX_FILE_BYTES) return { error: name + " exceeds the 2 MB per-file limit.", status: 413 as const };
    totalBytes += bytes;
  }
  if (totalBytes > MAX_PROJECT_BYTES) return { error: "The total project size limit is 3 MB.", status: 413 as const };
  if (Object.prototype.hasOwnProperty.call(files, entryFile)) return { error: "The selected entry file must be sent as source, not as a supporting file.", status: 400 as const };
  return { source, files: files as Record<string, string>, entryFile, totalBytes };
}

async function readPayload(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return { error: "The request exceeds the 4 MB upload limit.", status: 413 as const };
  }
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) {
      return { error: "The request exceeds the 260 KB upload limit.", status: 413 as const };
    }
    return validatePayload(JSON.parse(raw));
  } catch {
    return { error: "Request body must be valid JSON.", status: 400 as const };
  }
}

function runTectonic(cwd: string, outputDir: string, entryFile: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve, reject) => {
    const binary = process.env.TECTONIC_BIN || "tectonic";
    const child = spawn(binary, [
      "-X", "compile", "--outdir", outputDir, "--keep-logs",
      "--keep-intermediates", "--untrusted", entryFile
    ], {
      cwd,
      env: { ...process.env, HOME: "/tmp", XDG_CACHE_HOME: "/tmp/ors-tectonic-cache", TECTONIC_UNTRUSTED_MODE: "1" },
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
  const parsed = await readPayload(request);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  // Vercel is the public edge. It forwards only validated source to the private compiler.
  if (process.env.VERCEL) {
    const compilerUrl = process.env.ORS_COMPILER_URL;
    const token = process.env.ORS_COMPILER_TOKEN;
    if (!compilerUrl || !token) {
      return NextResponse.json({
        error: "Cloud compilation is not configured yet.",
        details: "The editor is available, but the Oracle compiler service must be connected by the workspace owner."
      }, { status: 503 });
    }
    let target: URL;
    try {
      target = new URL(compilerUrl);
      if (target.protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      return NextResponse.json({ error: "Compiler service configuration is invalid." }, { status: 503 });
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45_000);
      const response = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ source: parsed.source, files: parsed.files, entryFile: parsed.entryFile }),
        cache: "no-store",
        signal: controller.signal
      }).finally(() => clearTimeout(timer));
      const bytes = await response.arrayBuffer();
      if (!response.ok) {
        let error = "The compiler service rejected this job.";
        let details = "";
        try {
          const data = JSON.parse(new TextDecoder().decode(bytes));
          error = typeof data.error === "string" ? data.error : error;
          details = typeof data.logs === "string" ? data.logs : typeof data.details === "string" ? data.details : "";
        } catch {}
        return NextResponse.json({ error, details }, { status: response.status });
      }
      if (bytes.byteLength > MAX_PDF_BYTES || !response.headers.get("content-type")?.includes("application/pdf")) {
        return NextResponse.json({ error: "Compiler returned an invalid or oversized PDF." }, { status: 502 });
      }
      return new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="research-paper.pdf"', "Cache-Control": "no-store" }
      });
    } catch {
      return NextResponse.json({ error: "The cloud compiler could not be reached. Please retry shortly." }, { status: 503 });
    }
  }

  // A production self-hosted compiler must never be exposed without its shared secret.
  const configuredToken = process.env.ORS_COMPILER_TOKEN;
  if (process.env.NODE_ENV === "production" && !configuredToken) {
    return NextResponse.json({ error: "Compiler authentication is not configured." }, { status: 503 });
  }
  if (configuredToken && request.headers.get("authorization") !== `Bearer ${configuredToken}`) {
    return NextResponse.json({ error: "Unauthorized compiler request." }, { status: 401 });
  }
  if (activeCompiles >= MAX_CONCURRENT_COMPILES) {
    return NextResponse.json({ error: "The compiler is busy. Please retry in a moment." }, { status: 429, headers: { "Retry-After": "10" } });
  }

  activeCompiles += 1;
  const workspace = await mkdtemp(path.join(os.tmpdir(), "ors-tex-"));
  const outputDir = path.join(workspace, "output");
  try {
    await mkdir(outputDir, { recursive: true });
    await mkdir("/tmp/ors-tectonic-cache", { recursive: true });
    const entryPath = path.resolve(workspace, parsed.entryFile);
    if (!entryPath.startsWith(workspace + path.sep)) return NextResponse.json({ error: "Invalid entry file path." }, { status: 400 });
    await mkdir(path.dirname(entryPath), { recursive: true });
    await writeFile(entryPath, parsed.source, { encoding: "utf8", flag: "wx" });
    for (const [name, value] of Object.entries(parsed.files)) {
      const filePath = path.resolve(workspace, name);
      if (!filePath.startsWith(workspace + path.sep)) {
        return NextResponse.json({ error: "Invalid project file path." }, { status: 400 });
      }
      await mkdir(path.dirname(filePath), { recursive: true });
      if (/^data:(image\/(png|jpeg)|application\/pdf);base64,/.test(value)) {
        const encoded = value.slice(value.indexOf(",") + 1);
        await writeFile(filePath, Buffer.from(encoded, "base64"), { flag: "wx" });
      } else {
        await writeFile(filePath, value, { encoding: "utf8", flag: "wx" });
      }
    }

    let result;
    try {
      result = await runTectonic(workspace, outputDir, parsed.entryFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start Tectonic.";
      if (message.includes("ENOENT")) {
        return NextResponse.json({ error: "Tectonic is not installed on this server." }, { status: 503 });
      }
      return NextResponse.json({ error: "Could not start the LaTeX compiler." }, { status: 500 });
    }

    if (result.timedOut) return NextResponse.json({ error: "Compilation timed out after 35 seconds.", logs: result.stderr }, { status: 408 });
    if (result.code !== 0) {
      return NextResponse.json({
        error: "LaTeX compilation failed. Check the compiler output.",
        logs: (result.stderr + "\n" + result.stdout).trim().slice(-12_000)
      }, { status: 422 });
    }

    const outputName = path.basename(parsed.entryFile).replace(/\\.tex$/i, ".pdf");
    const pdfPath = path.join(outputDir, outputName);
    let pdfStat;
    try {
      pdfStat = await stat(pdfPath);
    } catch {
      return NextResponse.json({ error: `Tectonic finished but did not produce ${outputName}.`, logs: result.stderr }, { status: 500 });
    }
    if (pdfStat.size > MAX_PDF_BYTES) return NextResponse.json({ error: "The generated PDF exceeds the 12 MB response limit." }, { status: 413 });

    const pdf = await readFile(pdfPath);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="' + outputName + '"',
        "Cache-Control": "no-store",
        "X-Compiler": "Tectonic"
      }
    });
  } finally {
    activeCompiles -= 1;
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
