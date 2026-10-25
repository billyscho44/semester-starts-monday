import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncRecent } from "@/lib/strava";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const admin = createAdminClient();
    const { data: link } = await admin.from("strava_link").select("*").eq("user_id", user.id).maybeSingle();
    if (!link) return NextResponse.json({ error: "Strava is not connected" }, { status: 400 });
    const { data: settings } = await admin.from("settings").select("plan_start_date").eq("user_id", user.id).maybeSingle();
    const n = await syncRecent(admin, link, (settings?.plan_start_date as string) ?? "2026-10-25");
    return NextResponse.json({ synced: n });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}
