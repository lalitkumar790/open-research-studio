# Database setup (Neon PostgreSQL)

ORS uses Neon PostgreSQL as its planned persistent database. Neon has a free tier and provides managed PostgreSQL without requiring the application to run a database server.

## Create the free database

1. Create a free account at https://neon.com/.
2. Create a project named `open-research-studio`.
3. Choose a region close to the Vercel deployment (Mumbai if available; otherwise the nearest available region).
4. In the Neon dashboard, open **Connect** and copy both connection strings:
   - Pooled connection string for `DATABASE_URL`.
   - Direct connection string for `DIRECT_URL`.
5. Put both values in a local `.env.local` file (never commit it).
6. Add the same values as encrypted Vercel environment variables for Preview and Production when the database integration is ready.

Example:

```dotenv
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
DIRECT_URL="postgresql://.../neondb?sslmode=require"
```

## Schema

The initial schema is in [schema.sql](./schema.sql). It defines:

- Users and Auth.js-compatible account/session records.
- Projects and project membership roles.
- Project files, with text content in PostgreSQL and object-storage keys for binary assets.
- Parsed BibTeX references.
- Compilation job history and PDF storage keys.

Apply the schema to a new empty Neon database using the Neon SQL Editor, or with `psql` using the direct connection string:

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
```

## Important safety and rollout notes

- Never put either connection string in client-side code, a `NEXT_PUBLIC_*` variable, or Git.
- Do not expose database queries through unauthenticated API routes.
- The current app still uses browser localStorage for project data. This schema is the database foundation; it does not silently migrate or delete existing browser projects.
- Enable account authentication and enforce project ownership/membership checks before switching project reads and writes to PostgreSQL.
- Keep large PDFs and image assets in object storage; store their keys and metadata in `project_files` rather than base64 blobs in PostgreSQL.
- Back up/export important projects before the cloud-sync migration.
