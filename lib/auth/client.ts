"use client";

import { createAuthClient } from "@neondatabase/auth";

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL || "";

export const authClient = createAuthClient(authUrl);

export async function getAccessToken(): Promise<string> {
  if (!authUrl) throw new Error("Neon Auth is not configured for this deployment.");
  const response = await fetch(`${authUrl.replace(/\\/$/, "")}/token`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Your session has expired. Please sign in again.");
  const result = await response.json();
  const token = typeof result.token === "string" ? result.token : "";
  if (!token) throw new Error("Neon Auth did not return an access token.");
  return token;
}
