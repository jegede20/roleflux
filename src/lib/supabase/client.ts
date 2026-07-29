"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// Browser-side Supabase client (uses the anon key; subject to RLS).
//
// NOTE on the cast: @supabase/ssr@0.5.2 imports `GenericSchema` from a deep
// path that no longer exists in supabase-js 2.111.x, which collapses the
// wrapped client's schema to `never` and makes every query builder
// `never`-typed. Runtime is unaffected. Casting to supabase-js's own
// `SupabaseClient<Database>` — whose native schema resolution works —
// restores full type safety. Mirrors the cast in ./server.ts.
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as SupabaseClient<Database>;
}
