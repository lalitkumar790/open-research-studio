"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth/client";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) throw new Error(result.error.message || "Authentication failed.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not authenticate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a href="/" className="auth-brand">OPEN RESEARCH <span>STUDIO</span></a>
        <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p>Sign in to access your research workspace.</p>
        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && <label>Name<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required /></label>}
          <label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <p className="auth-switch">{mode === "signin" ? "New to ORS?" : "Already have an account?"} <button onClick={()=>{setMode(mode==="signin"?"signup":"signin");setError("");}}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
      </section>
    </main>
  );
}
