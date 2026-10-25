import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityKind = "walk" | "run" | "ride" | "other" | "strength";

export type ActivitySet = { set_no: number; reps: number; load_lb: number | null };

export type LoggedActivity = {
  id: string;
  date: string;
  kind: ActivityKind;
  label: string | null;
  minutes: number | null;
  distance_mi: number | null;
  note: string | null;
  exercise: { id: string; name: string; unit: "reps" | "seconds" | "minutes"; bw_factor: number | null } | null;
  sets: ActivitySet[];
};

export const KIND_LABEL: Record<ActivityKind, string> = {
  walk: "Walk", run: "Run", ride: "Ride", other: "Other cardio", strength: "Strength",
};

/** A manual cardio entry or a Strava activity needs at least this many minutes to count as an active day. */
export const MIN_ACTIVE_MIN = 10;

/** Extra bodyweight moves that are not in the plan but are easy to log on a day away from home. */
const EXTRA: [name: string, movement: string, unit: "reps" | "seconds", factor: number | null, basis: string | null][] = [
  ["Push-up", "horizontal push", "reps", 0.69, "study"],
  ["Knee push-up", "horizontal push", "reps", 0.54, "study"],
  ["Sit-up", "core", "reps", null, null],
  ["Plank", "core", "seconds", null, null],
];

/** Adds the extra moves to this user's exercise list when missing. Reads first so a normal page load writes nothing. */
export async function ensureExtraExercises(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data } = await supabase.from("exercise").select("name").in("name", EXTRA.map((e) => e[0]));
  const have = new Set((data ?? []).map((r) => r.name as string));
  const missing = EXTRA.filter((e) => !have.has(e[0]));
  if (!missing.length) return;
  await supabase.from("exercise").upsert(
    missing.map(([name, movement_pattern, unit, bw_factor, bw_basis]) => ({
      user_id: userId, name, type: "strength", movement_pattern, unit, bw_factor, bw_basis,
    })),
    { onConflict: "user_id,name", ignoreDuplicates: true },
  );
}

export type DayActivity = { minutes: number; sets: number; count: number };

/**
 * Every date with something logged, from manual entries and Strava.
 * Strava activities already matched to a plan session (session_id set) are listed with matched = true
 * so their minutes are not counted twice with the plan's checked-off steps.
 */
export async function loadActivityDays(supabase: SupabaseClient): Promise<{
  manual: Map<string, DayActivity>;
  strava: Map<string, DayActivity & { unmatchedMinutes: number }>;
}> {
  const [m, s] = await Promise.all([
    supabase.from("activity_log").select("id,date,kind,minutes,activity_set(id)"),
    supabase.from("strava_activity").select("local_date,moving_s,session_id"),
  ]);
  const manual = new Map<string, DayActivity>();
  for (const r of (m.data ?? []) as unknown as { date: string; kind: ActivityKind; minutes: number | null; activity_set: { id: string }[] }[]) {
    const cur = manual.get(r.date) ?? { minutes: 0, sets: 0, count: 0 };
    cur.count += 1;
    cur.minutes += r.minutes ?? 0;
    cur.sets += r.activity_set?.length ?? 0;
    manual.set(r.date, cur);
  }
  const strava = new Map<string, DayActivity & { unmatchedMinutes: number }>();
  for (const r of (s.data ?? []) as { local_date: string; moving_s: number | null; session_id: string | null }[]) {
    const mins = Math.round((r.moving_s ?? 0) / 60);
    const cur = strava.get(r.local_date) ?? { minutes: 0, sets: 0, count: 0, unmatchedMinutes: 0 };
    cur.count += 1;
    cur.minutes += mins;
    if (!r.session_id) cur.unmatchedMinutes += mins;
    strava.set(r.local_date, cur);
  }
  return { manual, strava };
}

/** Does this date count as active because of something logged outside the plan? */
export function activeFromLogs(
  date: string,
  manual: Map<string, DayActivity>,
  strava: Map<string, DayActivity>,
): boolean {
  const a = manual.get(date);
  if (a && (a.sets > 0 || a.minutes >= MIN_ACTIVE_MIN)) return true;
  const b = strava.get(date);
  return !!b && b.minutes >= MIN_ACTIVE_MIN;
}
