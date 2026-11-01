# Private project file storage

ORS stores binary project assets in the private Neon Object Storage bucket `uploads`.
The browser never receives S3 credentials. It asks the ORS API for a short-lived URL,
uploads directly to the private bucket, and asks the API to verify the resulting object.

## Required environment

Server-only:
- `DATABASE_URL`: pooled Neon PostgreSQL connection
- `NEON_AUTH_BASE_URL`: Neon Managed Auth endpoint
- `NEON_AUTH_JWKS_URL`: JWKS endpoint for the same Neon Auth branch
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `AWS_ENDPOINT_URL_S3`, `AWS_REGION`
- `NEON_STORAGE_BUCKET=uploads` (optional; defaults to uploads)

The browser auth SDK currently reads `NEXT_PUBLIC_NEON_AUTH_URL`. Set it to the
same branch's Neon Auth endpoint, but do not put database or S3 credentials in
NEXT_PUBLIC variables.

## API flow

1. Sign in through Neon Auth and obtain a short-lived access token.
2. Send it as `Authorization: Bearer <token>` to
   `POST /api/projects/{projectId}/files/upload-url` with
   `{ path, contentType, byteSize }`.
3. PUT the file bytes to the returned URL with the requested content type.
4. Call `POST /api/projects/{projectId}/files/{fileId}/complete`.
5. For downloads, call
   `GET /api/projects/{projectId}/files/{fileId}/download-url` and open the
   returned short-lived URL.

Upload URLs expire after five minutes; download URLs after two minutes.
The API verifies the JWT signature and expiry using the configured JWKS, maps
the Neon Auth subject to the ORS user table, and checks project ownership or
membership before issuing a URL. Uploads are limited to 10 MB.

## Important

- Project records must exist in `projects` and use UUID identifiers before
  these endpoints can be used. The current editor still uses numeric browser
  project IDs; the cloud project CRUD migration is a separate step.
- The app must send a valid Neon Auth access token. The current UI has not yet
  been switched from localStorage to cloud persistence.
- Never use `NEXT_PUBLIC_` for S3 credentials or database connection strings.
