import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_URL, stravaEnv, syncRecent } from "@/lib/strava";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${APP_URL}/settings?strava=${q}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const cookieState = req.cookies.get("strava_state")?.value;
  if (sp.get("error") || !code) return back("denied");
  if (!state || !cookieState || state !== cookieState) return back("bad-state");
  const scope = sp.get("scope") ?? "";
  if (!scope.includes("activity:read_all")) return back("scope");

  try {
    const { id, secret } = stravaEnv();
    const r = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: secret, code, grant_type: "authorization_code" }),
    });
    if (!r.ok) return back("token-failed");
    const t = await r.json();
    const admin = createAdminClient();
    const link = {
      user_id: user.id, athlete_id: t.athlete.id, access_token: t.access_token, refresh_token: t.refresh_token,
      expires_at: new Date(t.expires_at * 1000).toISOString(), scope,
    };
    const { error } = await admin.from("strava_link").upsert(link, { onConflict: "user_id" });
    if (error) return back("save-failed");
    const { data: settings } = await admin.from("settings").select("plan_start_date").eq("user_id", user.id).maybeSingle();
    if (settings) await syncRecent(admin, link, settings.plan_start_date as string);
  } catch {
    return back("error");
  }
  const res = back("connected");
  res.cookies.delete("strava_state");
  return res;
}
