import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { APP_URL, stravaEnv } from "@/lib/strava";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);
  let id: string;
  try { id = stravaEnv().id; } catch { return NextResponse.redirect(`${APP_URL}/settings?strava=missing-env`); }
  const state = crypto.randomUUID();
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", `${APP_URL}/api/strava/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "activity:read_all");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set("strava_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
