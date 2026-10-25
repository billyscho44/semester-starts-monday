"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsClient(props: {
  userId: string;
  maxHr: number;
  restingHr: number;
  zoneMethod: "reserve" | "max";
  stravaConnected: boolean | null;
  activityCount: number;
  lastSync: string | null;
  stravaFlash: string | null;
  bounds: number[];
}) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const [maxHr, setMaxHr] = useState(String(props.maxHr));
  const [restHr, setRestHr] = useState(String(props.restingHr));
  const [method, setMethod] = useState(props.zoneMethod);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveHr() {
    const m = Number(maxHr), r = Number(restHr);
    if (!(m >= 120 && m <= 230 && r >= 30 && r <= 120 && r < m)) { setErr("Check the numbers: max 120 to 230, resting 30 to 120."); return; }
    const { error } = await supabase.from("settings")
      .update({ max_hr: m, resting_hr: r, zone_method: method, updated_at: new Date().toISOString() }).eq("user_id", props.userId);
    setErr(error ? error.message : null);
    setMsg(error ? null : "Saved. New zones apply to rides synced from now on.");
    router.refresh();
  }

  async function call(path: string, method: "POST" | "GET", ok: (j: Record<string, unknown>) => string) {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch(path, { method });
      const j = await r.json();
      if (!r.ok) setErr(typeof j.error === "string" ? j.error : JSON.stringify(j.body ?? j));
      else setMsg(ok(j));
    } catch { setErr("Request failed."); }
    setBusy(false);
    router.refresh();
  }

  const flash: Record<string, string> = {
    connected: "Strava connected. Rides since Oct 24 were imported.",
    denied: "Strava access was not granted.",
    scope: "Strava access was granted without activity details. Reconnect and leave all boxes checked.",
    "bad-state": "The sign-in check failed. Try Connect again.",
    "token-failed": "Strava rejected the sign-in. Check the Client ID and Secret in Vercel.",
    "save-failed": "Could not save the Strava link. Check SUPABASE_SERVICE_ROLE_KEY in Vercel.",
    "missing-env": "Strava settings are missing in Vercel (client ID and secret).",
    error: "Something failed during Strava setup. Check the Vercel settings and try again.",
  };

  const card = "mt-4 rounded-2xl border border-line bg-card p-5";
  const btn = "min-h-11 rounded-xl border border-line px-4 text-sm disabled:opacity-40";
  const field = "h-11 w-24 rounded-xl border border-line bg-bg px-3 text-center";

  return (
    <>
      <section className={card}>
        <h2 className="text-base font-semibold">Strava</h2>
        {props.stravaFlash && flash[props.stravaFlash] && (
          <p className="mt-2 text-sm text-accent" role="status">{flash[props.stravaFlash]}</p>
        )}
        <p className="mt-2 text-sm text-muted">
          {props.stravaConnected === null ? "Link status unknown (server key not set)." : props.stravaConnected ? "Connected." : "Not connected."}
          {" "}{props.activityCount} activities imported{props.lastSync ? `, last sync ${props.lastSync}` : ""}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/strava/connect" className={`${btn} flex items-center`}>{props.stravaConnected ? "Reconnect" : "Connect Strava"}</a>
          <button disabled={busy || !props.stravaConnected} onClick={() => call("/api/strava/sync", "POST", (j) => `Synced ${j.synced} activities.`)} className={btn}>Sync now</button>
          <button disabled={busy || !props.stravaConnected} onClick={() => call("/api/strava/subscribe", "POST", () => "Live updates are on. New rides appear within a minute.")} className={btn}>Turn on live updates</button>
        </div>
        <p className="mt-2 text-xs text-muted">Live updates make rides appear on their own. If they are already on, Strava may answer that the subscription exists; that is fine.</p>
      </section>

      <section className={card}>
        <h2 className="text-base font-semibold">Heart rate</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-muted">Max HR<input inputMode="numeric" value={maxHr} onChange={(e) => setMaxHr(e.target.value.replace(/\D/g, ""))} className={`${field} mt-1 block`} /></label>
          <label className="text-sm text-muted">Resting HR<input inputMode="numeric" value={restHr} onChange={(e) => setRestHr(e.target.value.replace(/\D/g, ""))} className={`${field} mt-1 block`} /></label>
        </div>
        <div role="group" aria-label="Zone method" className="mt-3 flex gap-2">
          {([["reserve", "Heart-rate reserve"], ["max", "Percent of max"]] as const).map(([v, t]) => (
            <button key={v} type="button" aria-pressed={method === v} onClick={() => setMethod(v)}
              className={`min-h-11 flex-1 rounded-xl border px-2 text-sm ${method === v ? "border-accent bg-accent text-accent-ink" : "border-line"}`}>{t}</button>
          ))}
        </div>
        <button onClick={saveHr} className="mt-3 min-h-11 rounded-xl bg-accent px-5 font-medium text-accent-ink">Save</button>
        <p className="mt-3 text-xs text-muted">
          Zone edges now: Z2 from {Math.round(props.bounds[0])}, Z3 from {Math.round(props.bounds[1])}, Z4 from {Math.round(props.bounds[2])}, Z5 from {Math.round(props.bounds[3])} bpm.
          Max HR raises itself when a ride shows a higher number.
        </p>
      </section>
      {msg && <p className="mt-3 text-sm text-accent" role="status">{msg}</p>}
      {err && <p className="mt-3 text-sm text-danger" role="alert">{err}</p>}
    </>
  );
}
