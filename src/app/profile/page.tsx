import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import ProfileForm from "@/components/ProfileForm";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Profile · Roleflux" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single<Profile>();

  // Safety net: the signup trigger normally creates this row, but create it
  // here too in case a user predates the trigger.
  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .insert({ user_id: user.id })
      .select("*")
      .single<Profile>();
    profile = created;
  }

  if (!profile) {
    return (
      <main className="p-8 text-center text-ink-secondary">
        Could not load your profile. Please refresh.
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar active="profile" email={user.email} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-ink-primary">
            Your profile
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            This is what Roleflux uses to score jobs and draft applications.
            Fill it in once — you can tweak it anytime.
          </p>
        </div>
        <ProfileForm profile={profile} />
      </main>
    </div>
  );
}
