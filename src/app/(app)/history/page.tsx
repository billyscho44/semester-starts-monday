import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { shortLabel } from "@/lib/dates";
import { KIND_LABEL, type ActivityKind } from "@/lib/activity";

export const dynamic = "force-dynamic";

type Row = {
  date: string;
  status: string;
  miss_reason: string | null;
  zwift_workout: string | null;
  plan_day: { title: string } | null;
  session_feedback: { overall: string | null; energy_before: string | null; pain_flag: boolean; pain_area: string | null; note: string | null }[];
};

const LABEL: Record<string, string> = { done: "Done", partial: "Partly done", minimum: "Minimum day", skipped: "Skipped", activity: "Activity" };

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session")
    .select("date,status,miss_reason,zwift_workout,plan_day(title),session_feedback(overall,energy_before,pain_flag,pain_area,note)")
    .neq("status", "planned")
    .order("date", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Row[];

  const [logR, stravaR] = await Promise.all([
    supabase.from("activity_log").select("date,kind,label,minutes,note,exercise:exercise_id(name),activity_set(id)"),
    supabase.from("strava_activity").select("local_date,name,moving_s"),
  ]);
  const extras = new Map<string, string[]>();
  const add = (d: string, t: string) => extras.set(d, [...(extras.get(d) ?? []), t]);
  for (const a of (logR.data ?? []) as unknown as { date: string; kind: ActivityKind; label: string | null; minutes: number | null; note: string | null; exercise: { name: string } | null; activity_set: { id: string }[] }[]) {
    const name = a.kind === "strength" ? a.exercise?.name ?? "Strength" : a.kind === "other" ? a.label ?? "Other" : KIND_LABEL[a.kind];
    add(a.date, a.kind === "strength" ? `${name} ${a.activity_set?.length ?? 0} sets` : `${name} ${a.minutes ?? 0} min`);
  }
  for (const a of (stravaR.data ?? []) as { local_date: string; name: string | null; moving_s: number | null }[]) {
    add(a.local_date, `${a.name ?? "Strava"} ${Math.round((a.moving_s ?? 0) / 60)} min`);
  }
  const have = new Set(rows.map((r) => r.date));
  const onlyActivity = [...extras.keys()].filter((d) => !have.has(d));
  const all: (Row & { onlyActivity?: boolean })[] = [
    ...rows,
    ...onlyActivity.map((date) => ({ date, status: "activity", miss_reason: null, zwift_workout: null, plan_day: null, session_feedback: [], onlyActivity: true })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="text-4xl font-semibold tracking-tight">History</h1>
      {all.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-card p-5 text-sm text-muted">
          Nothing logged yet. Finish a session on Today and it appears here.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-card">
          {all.map((r) => {
            const f = r.session_feedback?.[0];
            return (
              <li key={r.date}>
                <Link href={`/day/${r.date}`} className="block px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-muted">{shortLabel(r.date)}</span>
                    <span className="text-xs text-accent">{LABEL[r.status]}</span>
                  </div>
                  <p className="mt-0.5 text-sm">{r.plan_day?.title ?? (r.onlyActivity ? "Off-plan day" : "Session")}</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted">
                    {[
                      f?.overall && `Overall ${f.overall}`,
                      f?.energy_before && `energy ${f.energy_before}`,
                      r.zwift_workout && `Zwift: ${r.zwift_workout}`,
                      f?.pain_flag && `pain: ${f.pain_area || "yes"}`,
                      r.miss_reason && `reason: ${r.miss_reason}`,
                      f?.note,
                    ].filter(Boolean).join(" · ")}
                  </p>
                  {extras.get(r.date) && <p className="mt-0.5 text-xs leading-snug text-muted">Also: {extras.get(r.date)!.join(", ")}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
