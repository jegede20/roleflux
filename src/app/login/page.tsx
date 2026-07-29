import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Sign in · Roleflux" };

// Rendered at request time: AuthForm instantiates a Supabase client that needs
// the runtime env vars, which aren't present during static prerender.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-2xl font-semibold text-ink-primary"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white">
              R
            </span>
            Roleflux
          </Link>
          <p className="mt-2 text-sm text-ink-secondary">
            Your AI copilot for the remote job hunt.
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card sm:p-8">
          <AuthForm />
        </div>

        <p className="mt-6 text-center text-xs text-ink-secondary">
          By continuing you agree to let Roleflux score jobs against your
          profile using AI.
        </p>
      </div>
    </main>
  );
}
