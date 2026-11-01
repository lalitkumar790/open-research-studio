# Free Cloudflare Quick Tunnel for the local compiler

This is a temporary development bridge from the Vercel-hosted editor to the Tectonic compiler running in Docker on a Windows PC. It requires no Cloudflare account and no custom domain.

> **Development only:** Quick Tunnel URLs are random and temporary. They stop working when `cloudflared` exits, change when restarted, and have no uptime guarantee. Do not treat this as production hosting.

## Prerequisites

- Docker Desktop is running.
- The Open Research Studio Compose service is running and local compilation has been tested.
- The compiler token is stored locally in `.env` and `.compiler-token`; never commit or share it.
- Install the current Windows 64-bit `cloudflared` executable from the official [Cloudflare downloads page](https://developers.cloudflare.com/tunnel/downloads/).

Verify installation in PowerShell:

```powershell
cloudflared --version
```

## Start the tunnel

In PowerShell terminal 1, start the local service:

```powershell
cd C:\Users\Dell\Documents\open-research-studio
docker compose up -d
```

Confirm it is running:

```powershell
docker compose ps
```

In PowerShell terminal 2, start the Quick Tunnel:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Wait for the generated URL ending in `.trycloudflare.com`. Keep this terminal open while the compiler is needed.

## Connect Vercel

In the Vercel project settings, set these server-side environment variables for the relevant deployment environments:

- `ORS_COMPILER_URL`: the full URL including the API path, for example `https://<random-name>.trycloudflare.com/api/compile`
- `ORS_COMPILER_TOKEN`: the exact same secret as the local `ORS_COMPILER_TOKEN` value in `.env`

Do not add either variable with a `NEXT_PUBLIC_` prefix. Do not put the token in browser code, source files, screenshots, or Git.

Redeploy the Vercel project after changing environment variables. Then open the Vercel-hosted editor and compile a small LaTeX document.

## Important security and availability notes

- The tunnel publishes the local Next.js service on port 3000. The application pages are reachable by anyone who knows the temporary URL. The compiler API requires the bearer token in production mode; keep that token private.
- Do not enable email-gated Quick Tunnel access for this Vercel-to-compiler connection: Vercel makes a server-to-server HTTP request and cannot complete an interactive email PIN flow.
- Keep Docker bound to `127.0.0.1:3000`; do not change it to `0.0.0.0:3000` or open router ports.
- The laptop must remain powered on, awake, online, with Docker and the `cloudflared` process running. Sleep, shutdown, network loss, or closing the tunnel terminal disconnects compilation.
- The random hostname changes whenever a new Quick Tunnel is started. Update `ORS_COMPILER_URL` in Vercel and redeploy after each restart.
- Quick Tunnels are for testing and development, not production. Cloudflare documents a 200 in-flight request limit and no Server-Sent Events support.

## Stop the tunnel

Press `Ctrl+C` in the terminal running `cloudflared`. The temporary URL stops working. The Docker compiler can remain running locally.
