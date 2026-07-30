"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "magic" | "password";

// Supabase Auth returns raw, sometimes cryptic error strings. Translate the
// ones users actually hit into plain, actionable guidance. The rate-limit case
// is important: it's a cap on Supabase's email *sender*, not on how many
// accounts can exist — so we point users at the password flow, which needs no
// email when confirmation is disabled.
function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Email sending is temporarily throttled (a limit on the email service, not on new accounts). Use the Password tab to create an account instantly, or try the magic link again in a few minutes.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "That email already has an account. Switch to “Sign in” below.";
  }
  if (m.includes("invalid login credentials")) {
    return "Email or password is incorrect. If you signed up with a magic link, use the Magic link tab instead.";
  }
  return raw;
}

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
    // One link handles BOTH sign-in and sign-up: shouldCreateUser (the default,
    // set explicitly here) makes Supabase create the account if the email is
    // new, or just sign in if it already exists.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(friendlyError(error.message));
    } else {
      setStatus("sent");
      setMessage(
        "Check your inbox for a sign-in link. It works whether or not you already have an account."
      );
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${siteUrl}/auth/callback` },
      });
      if (error) {
        setStatus("error");
        setMessage(friendlyError(error.message));
      } else if (data.session) {
        // Email confirmation is off → Supabase returned a live session, so the
        // account is ready immediately with no email sent. This is the path to
        // effectively unlimited sign-ups (no email quota involved).
        window.location.href = "/dashboard";
      } else {
        // Email confirmation is on → a verification email was sent.
        setStatus("sent");
        setMessage(
          "Account created. Check your inbox to confirm your email, then sign in."
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setStatus("error");
        setMessage(friendlyError(error.message));
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
