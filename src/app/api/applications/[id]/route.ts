import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/applications/:id
// Body may contain any subset of: status, notes, tailored_resume,
// tailored_cover_letter. Used by drag-and-drop (status) and autosave (notes /
// edited drafts). RLS scopes the update to the caller's own profile.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  const update: Partial<Application> = {};

  if ("status" in body) {
    const status = body.status as ApplicationStatus;
    if (!APPLICATION_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = status;
  }
  if ("notes" in body) update.notes = String(body.notes ?? "");
  if ("tailored_resume" in body)
    update.tailored_resume = String(body.tailored_resume ?? "");
  if ("tailored_cover_letter" in body)
    update.tailored_cover_letter = String(body.tailored_cover_letter ?? "");

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // We need the caller's profile id to scope the row (RLS enforces it too).
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
    .update(update)
    .eq("id", params.id)
    .eq("profile_id", profile.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, application: data });
}

// DELETE /api/applications/:id — remove a card from the board.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", params.id)
    .eq("profile_id", profile.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
