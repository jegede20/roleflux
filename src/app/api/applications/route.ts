import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/applications
// Body: { job_id: string }. Saves a job to the caller's board as a
// "new_match" card. Used by the Browse page so a user can add real jobs
// even when the AI matcher surfaces nothing. Idempotent: re-adding a job
// already on the board is a no-op (upsert on profile_id,job_id).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobId = typeof body.job_id === "string" ? body.job_id : "";
  if (!jobId) {
    return NextResponse.json({ error: "job_id is required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("applications")
    .upsert(
      {
        profile_id: profile.id,
        job_id: jobId,
        status: "new_match",
      },
      { onConflict: "profile_id,job_id", ignoreDuplicates: true }
    )
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // ignoreDuplicates returns no row when the card already existed — still a
  // success from the caller's perspective.
  return NextResponse.json({ ok: true, application: data ?? null });
}
