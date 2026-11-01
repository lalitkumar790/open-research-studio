# LaTeX compilation

Open Research Studio uses [Tectonic](https://tectonic-typesetting.github.io/) to compile a single-file LaTeX document into PDF.

## Local development

1. Install Tectonic using the official instructions: https://tectonic-typesetting.github.io/book/latest/installation/
2. Verify that `tectonic --version` works in the same shell used to run Next.js.
3. Start the app with `npm install && npm run dev`.
4. Open a project, edit `main.tex`, and select **Compile**.

If the binary is not on PATH, set `TECTONIC_BIN` to its absolute path.

## Docker (recommended)

The repository Dockerfile installs the official Tectonic executable into the production image and builds Next.js in standalone mode.

```bash
docker compose up --build
```

Open http://localhost:3000.

## API

`POST /api/compile`

Request JSON:

```json
{ "source": "\\documentclass{article}\\begin{document}Hello\\end{document}" }
```

Success: PDF bytes with `Content-Type: application/pdf`.

Errors: JSON containing `error`, and when available `logs` or `details`.

Current guardrails:
- 200 KB maximum source payload
- 35 second compilation timeout
- 12 MB maximum PDF response
- Per-request temporary directory with cleanup
- No shell interpolation; Tectonic is launched with a fixed argument list
- No user-supplied filenames or paths

## Current limitations and deployment safety

This first compiler integration accepts one `main.tex` source file. It does not yet upload referenced images, bibliography files, custom class/style files, or other project assets. Documents that depend on those files will not compile until multi-file project packaging is implemented.

Tectonic may download TeX bundle packages on first use. The compiler needs outbound network access for that package cache. The API currently has no user authentication, durable job queue, or distributed rate limiting. Do not expose the compile endpoint to an untrusted public audience until authentication, quotas, and stronger process/container isolation are added. The supplied Compose configuration applies container-level resource limits for self-hosted deployments, but it does not replace per-job sandboxing.
