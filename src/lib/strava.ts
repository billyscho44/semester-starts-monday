import type { SupabaseClient } from "@supabase/supabase-js";
import { dayIndex } from "./dates";

const API = "https://www.strava.com/api/v3";

export const APP_URL = process.env.APP_URL ?? "https://semester-starts-monday.vercel.app";

export function stravaEnv() {
  const id = process.env.STRAVA_CLIENT_ID;
  const secret = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !secret) throw new Error("STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET is not set");
  return { id, secret };
}

type Link = { user_id: string; athlete_id: number; access_token: string; refresh_token: string; expires_at: string };

/** Returns a valid access token, refreshing (and storing the rotated refresh token) when needed. */
export async function validToken(admin: SupabaseClient, link: Link): Promise<string> {
  if (new Date(link.expires_at).getTime() - Date.now() > 5 * 60_000) return link.access_token;
  const { id, secret } = stravaEnv();
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "refresh_token", refresh_token: link.refresh_token }),
  });
  if (!r.ok) throw new Error(`Strava token refresh failed (${r.status})`);
  const t = await r.json();
  await admin.from("strava_link").update({
    access_token: t.access_token, refresh_token: t.refresh_token,
    expires_at: new Date(t.expires_at * 1000).toISOString(),
  }).eq("user_id", link.user_id);
  return t.access_token;
}

async function get(token: string, path: string) {
  const r = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Strava ${path} failed (${r.status})`);
  return r.json();
}

export const listActivities = (token: string, afterEpoch: number) =>
  get(token, `/athlete/activities?after=${afterEpoch}&per_page=50`) as Promise<{ id: number }[]>;

type Settings = { max_hr: number; resting_hr: number; zone_method: "reserve" | "max"; plan_start_date: string };

export function zoneBounds(s: Pick<Settings, "max_hr" | "resting_hr" | "zone_method">): number[] {
  if (s.zone_method === "max") return [0.6, 0.7, 0.8, 0.9].map((p) => p * s.max_hr);
  const r = s.max_hr - s.resting_hr;
  return [0.5, 0.7, 0.8, 0.9].map((p) => s.resting_hr + p * r);
}

/** Seconds in Z1..Z5 from the heart-rate stream. */
export function zoneSeconds(time: number[], hr: number[], bounds: number[]): number[] {
  const z = [0, 0, 0, 0, 0];
  for (let i = 1; i < time.length && i < hr.length; i++) {
    const dt = Math.min(30, Math.max(0, time[i] - time[i - 1]));
    let k = 0;
    while (k < bounds.length && hr[i] >= bounds[k]) k++;
    z[k] += dt;
  }
  return z.map((v) => Math.round(v));
}

const CARDIO = new Set([
  "Ride", "VirtualRide", "EBikeRide", "MountainBikeRide", "GravelRide", "Run", "VirtualRun", "TrailRun",
  "Walk", "Hike", "Swim", "Rowing", "Elliptical", "StairStepper", "Workout", "HighIntensityIntervalTraining",
]);

type Step = { type: string; label?: string; min?: number };

/** Fetches one activity, stores it with zone times, and marks that day's cardio session when it fits. */
export async function processActivity(admin: SupabaseClient, link: Link, activityId: number): Promise<void> {
  const token = await validToken(admin, link);
  const a = await get(token, `/activities/${activityId}`);
  const { data: settings } = await admin.from("settings").select("max_hr,resting_hr,zone_method,plan_start_date").eq("user_id", link.user_id).maybeSingle();
  if (!settings) throw new Error("No settings row");
  const s = settings as Settings;

  let zones: number[] | null = null;
  if (a.has_heartrate) {
    const st = await get(token, `/activities/${activityId}/streams?keys=time,heartrate&key_by_type=true`);
    if (st.time?.data && st.heartrate?.data) zones = zoneSeconds(st.time.data, st.heartrate.data, zoneBounds(s));
  }

  const localDate = String(a.start_date_local).slice(0, 10);
  const row = {
    id: a.id, user_id: link.user_id, started_at: a.start_date, local_date: localDate,
    name: a.name, sport_type: a.sport_type ?? a.type, trainer: a.trainer ?? null, device_name: a.device_name ?? null,
    elapsed_s: a.elapsed_time ?? null, moving_s: a.moving_time ?? null, distance_m: a.distance ?? null,
    avg_hr: a.average_heartrate ?? null, max_hr: a.max_heartrate ?? null,
    avg_watts: a.average_watts ?? null, device_watts: a.device_watts ?? null, kilojoules: a.kilojoules ?? null,
    zone_seconds: zones, perceived_exertion: a.perceived_exertion ?? null, raw: a, synced_at: new Date().toISOString(),
  };

  if (a.max_heartrate && a.max_heartrate > s.max_hr) {
    await admin.from("settings").update({ max_hr: Math.round(a.max_heartrate), updated_at: new Date().toISOString() }).eq("user_id", link.user_id);
  }

  // Match to the planned day
  const idx = dayIndex(s.plan_start_date, localDate);
  let sessionId: string | null = null;
  if (idx >= 0 && idx < 28 && CARDIO.has(row.sport_type)) {
    const { data: pd } = await admin.from("plan_day")
      .select("id,session_kind,steps").eq("user_id", link.user_id)
      .eq("week_no", Math.floor(idx / 7) + 1).eq("day_no", (idx % 7) + 1).maybeSingle();
    if (pd && (pd.session_kind === "cardio" || pd.session_kind === "recovery")) {
      const { data: sess } = await admin.from("session")
        .upsert({ user_id: link.user_id, date: localDate, plan_day_id: pd.id }, { onConflict: "user_id,date" })
        .select("id,status,zwift_workout").single();
      if (sess) {
        sessionId = sess.id;
        const steps = pd.steps as Step[];
        const planned = steps
          .filter((x) => x.type === "step" && !["Flexibility", "Core and balance"].includes(x.label ?? ""))
          .reduce((t, x) => t + (x.min ?? 0), 0);
        const mins = (row.moving_s ?? 0) / 60;
        const next = mins >= 0.8 * planned ? "done" : mins >= 10 ? "minimum" : null;
        const rank: Record<string, number> = { planned: 0, skipped: 0, minimum: 1, partial: 2, done: 3 };
        if (next && rank[next] > (rank[sess.status] ?? 0)) {
          await admin.from("session").update({
            status: next, completed_at: new Date().toISOString(),
            zwift_workout: sess.zwift_workout ?? (row.trainer || row.sport_type === "VirtualRide" ? row.name : null),
          }).eq("id", sess.id);
          if (next === "done") {
            const checks = steps
              .map((x, i) => ({ x, i }))
              .filter(({ x }) => x.type === "step" && x.label !== "Flexibility" && x.label !== "Core and balance")
              .map(({ i }) => ({
                user_id: link.user_id, session_id: sess.id, kind: "step", ref: String(i), set_no: 0, done: true,
              }));
            if (checks.length) await admin.from("check_log").upsert(checks, { onConflict: "session_id,kind,ref,set_no", ignoreDuplicates: true });
          }
        }
      }
    }
  }
  await admin.from("strava_activity").upsert({ ...row, session_id: sessionId }, { onConflict: "id" });
}

/** Syncs every activity from the day before the plan start through now. */
export async function syncRecent(admin: SupabaseClient, link: Link, planStart: string): Promise<number> {
  const token = await validToken(admin, link);
  const after = Math.floor(new Date(`${planStart}T00:00:00Z`).getTime() / 1000) - 86400;
  const list = await listActivities(token, after);
  let n = 0;
  for (const x of list) {
    await processActivity(admin, link, x.id);
    n++;
  }
  await admin.from("strava_link").update({ last_sync_at: new Date().toISOString() }).eq("user_id", link.user_id);
  return n;
}
