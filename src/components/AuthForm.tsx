"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "magic" | "password";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("magic");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const supabase = createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
      setMessage("Check your inbox for a magic sign-in link.");
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${siteUrl}/auth/callback` },
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("sent");
        setMessage(
          "Account created. If email confirmation is on, check your inbox — otherwise you can sign in now."
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        window.location.href = "/dashboard";
      }
    }
  }

  return (
    <div className="w-full">
      {/* Mode toggle */}
      <div className="mb-6 flex rounded-md border border-border bg-background p-1">
        <button
          type="button"
          onClick={() => {
            setMode("magic");
            setStatus("idle");
            setMessage("");
          }}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition ${
            mode === "magic"
              ? "bg-surface text-ink-primary shadow-sm"
              : "text-ink-secondary"
          }`}
        >
          Magic link
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setStatus("idle");
            setMessage("");
          }}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition ${
            mode === "password"
              ? "bg-surface text-ink-primary shadow-sm"
              : "text-ink-secondary"
          }`}
        >
          Password
        </button>
      </div>

      <form
        onSubmit={mode === "magic" ? handleMagic : handlePassword}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-primary">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {mode === "password" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-primary">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {status === "loading"
            ? "Working…"
            : mode === "magic"
            ? "Send magic link"
            : isSignUp
            ? "Create account"
            : "Sign in"}
        </button>
      </form>

      {mode === "password" && (
        <button
          type="button"
          onClick={() => setIsSignUp((v) => !v)}
          className="mt-4 w-full text-center text-sm text-ink-secondary hover:text-ink-primary"
        >
          {isSignUp
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      )}

      {message && (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            status === "error"
              ? "bg-danger/10 text-red-600"
              : "bg-accent/10 text-accent"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
