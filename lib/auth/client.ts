"use client";

import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();

// The browser and ORS API share the same origin. Neon Auth's HttpOnly session
// cookie is validated server-side by createNeonAuth(); no browser JWT endpoint
// is needed for ordinary project API calls.
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  return fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store"
  });
}
