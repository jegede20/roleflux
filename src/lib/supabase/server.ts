import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// Server-side Supabase client bound to the request's cookies (subject to RLS,
// authenticated as the current user). Use inside Server Components, Route
// Handlers and Server Actions.
//
// NOTE on the cast: @supabase/ssr@0.5.2 imports `GenericSchema` from a deep
// path (`@supabase/supabase-js/dist/module/lib/types`) that no longer exists in
// supabase-js 2.111.x, which collapses the wrapped client's schema to `never`
// and makes every query builder `never`-typed. Runtime is unaffected (the peer
// dependency is satisfied). Casting to supabase-js's own `SupabaseClient<Database>`
// — whose native schema resolution works — restores full type safety.
export function createClient(): SupabaseClient<Database> {
  const cookieStore = cookies();

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` is called from a Server Component where cookies are
            // read-only. Middleware refreshes the session, so this is safe to
            // ignore.
          }
        },
      },
    }
  );

  return client as unknown as SupabaseClient<Database>;
}

// Service-role client — bypasses RLS. SERVER ONLY. Use for cron ingestion and
// bulk matching where there is no user session.
export function createServiceClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
