import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { APP_URL, stravaEnv } from "@/lib/strava";

export const dynamic = "force-dynamic";

/** GET: is a live-update subscription active. POST: create it. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const { id, secret } = stravaEnv();
    const r = await fetch(`https://www.strava.com/api/v3/push_subscriptions?client_id=${id}&client_secret=${secret}`);
    const list = (await r.json()) as { id: number; callback_url: string }[];
    return NextResponse.json({ active: Array.isArray(list) && list.length > 0, list });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const { id, secret } = stravaEnv();
    const verify = process.env.STRAVA_VERIFY_TOKEN;
    if (!verify) return NextResponse.json({ error: "STRAVA_VERIFY_TOKEN is not set" }, { status: 400 });
    const r = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: secret, callback_url: `${APP_URL}/api/webhooks/strava`, verify_token: verify }),
    });
    const body = await r.json().catch(() => ({}));
    return NextResponse.json({ ok: r.ok, status: r.status, body }, { status: r.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
