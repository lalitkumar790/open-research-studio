"use client";

import { createAuthClient } from "@neondatabase/auth/next";

// Use Neon's same-origin Next.js proxy. This keeps the browser session cookie
// on the ORS domain instead of relying on cross-origin cookie behaviour.
export const authClient = createAuthClient();

export async function getAccessToken(): Promise<string> {
  const result = await authClient.token();
  if (result.error) {
    throw new Error(result.error.message || "Your session has expired. Please sign in again.");
  }
  const token = result.data?.token;
  if (typeof token !== "string" || !token) {
    const session = await authClient.getSession();
    if (session.error) {
      throw new Error(session.error.message || "Could not read your sign-in session.");
    }
    if (!session.data?.session) {
      throw new Error("Your sign-in session is missing. Please sign in again.");
    }
    throw new Error("Your session exists, but Neon Auth did not issue an API access token. Please sign out and sign in again.");
  }
  return token;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers, cache: "no-store" });
}
