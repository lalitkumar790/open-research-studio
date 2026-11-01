"use client";

import { createAuthClient } from "@neondatabase/auth";

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL || "";
export const authClient = createAuthClient(authUrl);

export async function getAccessToken(): Promise<string> {
  if (!authUrl) throw new Error("Neon Auth is not configured for this deployment.");
  const client = authClient as typeof authClient & { getJWTToken?: () => Promise<unknown> };
  if (typeof client.getJWTToken === "function") {
    const value = await client.getJWTToken();
    if (typeof value === "string" && value) return value;
    if (value && typeof value === "object") {
      const item = value as { token?: string; access_token?: string; data?: string };
      const token = item.token || item.access_token || item.data;
      if (typeof token === "string" && token) return token;
    }
  }
  const response = await fetch(`${authUrl.replace(/\\/$/, "")}/token`, {
    method: "GET", credentials: "include", cache: "no-store",
  });
  if (!response.ok) throw new Error("Your session has expired. Please sign in again.");
  const result = await response.json();
  const token = result?.token || result?.access_token || result?.data?.token || result?.data?.access_token;
  if (typeof token !== "string" || !token) throw new Error("Neon Auth did not return an access token.");
  return token;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers, cache: "no-store" });
}
