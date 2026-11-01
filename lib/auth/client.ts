"use client";

import { createAuthClient } from "@neondatabase/auth";

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL || "";
export const authClient = createAuthClient(authUrl);

export async function getAccessToken(): Promise<string> {
  const result = await authClient.token();
  if (result.error) throw new Error(result.error.message || "Your session has expired. Please sign in again.");
  const token = result.data?.token;
  if (typeof token !== "string" || !token) throw new Error("Neon Auth did not return an access token.");
  return token;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers, cache: "no-store" });
}
