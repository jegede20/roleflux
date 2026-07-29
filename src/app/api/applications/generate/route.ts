import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDraft } from "@/lib/matching";
import type { Job, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// On-demand only: the user clicked "Generate Draft" on a specific application.
// Body: { applicationId: string }
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { applicationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single<Profile>();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Fetch the application (RLS ensures it belongs to this user) + its job.
  const { data: application } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("id", body.applicationId)
    .eq("profile_id", profile.id)
    .single<{ id: string; status: string; job: Job }>();

  if (!application || !application.job) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  try {
    const draft = await generateDraft(profile, application.job);

    // Store the draft and advance status to "drafted" (unless already further
    // along the pipeline, in which case keep the user's status).
    const nextStatus =
      application.status === "new_match" ? "drafted" : application.status;

    const { data: updated, error } = await supabase
      .from("applications")
      .update({
        tailored_resume: draft.resume_summary,
        tailored_cover_letter: draft.cover_letter,
        status: nextStatus as never,
      })
      .eq("id", application.id)
      .eq("profile_id", profile.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, application: updated, draft });
  } catch (err) {
    console.error("[generate] failed:", err);
    return NextResponse.json(
      { error: "Draft generation failed. Please try again." },
      { status: 502 }
    );
  }
}
