# Oracle Cloud compiler deployment

This guide deploys the Tectonic compiler as a private backend. The Vercel app remains the public frontend. Do not expose port 3000 directly to the internet.

## 1. Create the OCI VM

1. Sign in to the Oracle Cloud Console and select your tenancy's **home region**.
2. Open **Compute → Instances → Create instance**.
3. Choose an Ubuntu ARM64 image and the **VM.Standard.A1.Flex** shape.
4. For an Always Free tenancy, stay within the documented allowance: **2 OCPUs and 12 GB RAM total** across A1 instances. Always Free capacity may be temporarily unavailable; do not select a paid shape to work around that.
5. Assign a public IPv4 address. Create or select a public subnet with an internet gateway.
6. Add ingress rules for TCP 22 (restrict source to your own public IP), TCP 80 and TCP 443. Do not add a public ingress rule for TCP 3000.
7. Create an SSH key pair and save the private key securely. Never commit it to GitHub or paste it into ChatGPT.

Oracle Always Free resources must be created in the tenancy home region. Capacity errors can be temporary. Check the Always Free label in the Console before creating any resource.

## 2. Install Docker on Ubuntu

Connect over SSH using the private key you created:

```bash
ssh -i /path/to/private-key ubuntu@YOUR_VM_PUBLIC_IP
```

Install Docker Engine and the Compose plugin using Docker's official Ubuntu installation instructions. Then clone the repository:

```bash
git clone https://github.com/lalitkumar790/open-research-studio.git
cd open-research-studio
```

## 3. Configure the compiler secret

Generate a strong random secret on the VM:

```bash
openssl rand -hex 32
```

Create a private environment file. Paste the generated value after the equals sign. Do not add quotes or commit this file:

```bash
umask 077
nano .env
# Add:
ORS_COMPILER_TOKEN=PASTE_YOUR_RANDOM_SECRET_HERE
chmod 600 .env
```

Build and start the compiler:

```bash
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100
```

The container is configured with a read-only root filesystem, dropped Linux capabilities, no-new-privileges, a 1 GB memory cap, a 1 CPU cap, a PID limit, and a bounded temporary filesystem. The app binds to 127.0.0.1:3000 so the compiler is not directly reachable from the public internet.

## 4. Put HTTPS in front of the compiler

You need a DNS hostname pointing to the VM public IP, for example a free DuckDNS hostname. Configure the hostname's A record to the VM public IP.

Install Caddy on the Ubuntu host using Caddy's official installation instructions. Create `/etc/caddy/Caddyfile`:

```caddy
compiler.YOUR-DOMAIN.example {
    reverse_proxy 127.0.0.1:3000
}
```

Replace the example hostname with your actual hostname, then reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy obtains and renews a TLS certificate automatically when DNS and ports 80/443 are correctly configured. Confirm that HTTPS works before connecting Vercel.

## 5. Connect Vercel to the compiler

In the Vercel dashboard:

1. Open the **open-research-studio** project.
2. Go to **Settings → Environment Variables**.
3. Add `ORS_COMPILER_URL` with the full URL, including the path, e.g. `https://compiler.YOUR-DOMAIN.example/api/compile`.
4. Add `ORS_COMPILER_TOKEN` with exactly the same random secret stored in the VM's `.env`.
5. Set both variables for **Production** (and Preview only if you intentionally want preview deployments to use the compiler).
6. Redeploy the latest production commit so the server route receives the new variables.

The token is read only by the server-side Vercel route and is never sent to the browser. Do not use a `NEXT_PUBLIC_` prefix for it.

## 6. Verify safely

From the VM, check that the service is healthy:

```bash
docker compose ps
docker compose logs --tail=100
```

From the app, create a small document and compile it. Confirm that a PDF appears. Then check the Vercel function logs and VM logs for errors.

Do not test with untrusted projects until the service is behind HTTPS and authenticated. Keep the token private. Rotate it immediately if it is exposed.

## 7. Cost and capacity guardrails

- Use only resources explicitly marked **Always Free Eligible**.
- Keep the VM within the Always Free A1 allowance for an Always Free tenancy.
- Configure an OCI budget and alert before creating any additional paid resource.
- Monitor CPU, memory, boot volume, network egress and instance availability in OCI.
- The compiler intentionally rejects projects above 200 KB of source, 20 supporting files, 35 seconds compile time, or 12 MB PDF output.
- Current concurrency is limited to two jobs per compiler process. This is an initial guardrail, not a distributed queue.
- Do not increase limits until actual workload and cost data justify it.

## Important current limitations

- This compiler is a single-instance service; it does not yet have a durable queue, per-user quotas, distributed rate limiting, or persistent job history.
- Browser project drafts are still stored in localStorage. They do not sync across devices and are not account-backed.
- ZIP archives, images, and arbitrary project directory structures are not yet supported by the current importer/compiler contract.
- For public launch, add durable accounts/storage, a distributed queue, edge rate limiting, abuse monitoring, backups, and a formal privacy policy before accepting sensitive research documents.
