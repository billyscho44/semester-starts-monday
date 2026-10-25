import { createClient } from "@/lib/supabase/server";
import { addDays, dayIndex, shortLabel, todayIso } from "@/lib/dates";
import { loadAllPlanDays, type PlanDay } from "@/lib/plan";
import FactorEditor from "@/components/FactorEditor";
import { activeFromLogs, loadActivityDays, MIN_ACTIVE_MIN } from "@/lib/activity";
import { BarChart, LineChart, Spark, StackedBars, type Bar, type Pt, type Stack } from "@/components/charts";

export const dynamic = "force-dynamic";

type Sess = { id: string; date: string; plan_day_id: string | null; status: string };
type Chk = { session_id: string; kind: string; ref: string; set_no: number; done: boolean; reps: number | null; load_lb: number | null; bw_factor: number | null };

const ACTIVE = new Set(["done", "partial", "minimum"]);

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {sub && <p className="mt-0.5 text-xs leading-snug text-muted">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("plan_start_date").maybeSingle();
  const start = (settings?.plan_start_date as string) ?? todayIso();
  const today = todayIso();
  const idxToday = dayIndex(start, today);

  const [days, sessR, chkR, resR, itemR, wR, exR, actR, logs, manR] = await Promise.all([
    loadAllPlanDays(supabase),
    supabase.from("session").select("id,date,plan_day_id,status"),
    supabase.from("check_log").select("session_id,kind,ref,set_no,done,reps,load_lb,bw_factor").eq("done", true),
    supabase.from("exercise_result").select("session_id,rating"),
    supabase.from("plan_item").select("id,exercise:exercise_id(name,unit)"),
    supabase.from("weight_log").select("date,weight_lb").order("date"),
    supabase.from("exercise").select("id,name,bw_factor,bw_basis").order("name"),
    supabase.from("strava_activity").select("id,name,local_date,moving_s,avg_hr,avg_watts,device_watts,zone_seconds,sport_type").order("local_date"),
    loadActivityDays(supabase),
    supabase.from("activity_log").select("id,date,kind,exercise:exercise_id(name,unit),activity_set(reps,load_lb,bw_factor)").eq("kind", "strength"),
  ]);
  type ManualSet = { reps: number; load_lb: number | null; bw_factor: number | null };
  const manualStrength = ((manR.data ?? []) as unknown as { id: string; date: string; exercise: { name: string; unit: string } | null; activity_set: ManualSet[] }[]);
  const sessions = (sessR.data ?? []) as Sess[];
  const checks = (chkR.data ?? []) as Chk[];
  const results = (resR.data ?? []) as { session_id: string; rating: "easy" | "average" | "hard" }[];
  const itemInfo = new Map(
    ((itemR.data ?? []) as unknown as { id: string; exercise: { name: string; unit: string } | null }[]).map((i) => [
      i.id, { name: i.exercise?.name ?? "?", unit: i.exercise?.unit ?? "reps" },
    ]),
  );
  type Act = { id: number; name: string | null; local_date: string; moving_s: number | null; avg_hr: number | null; avg_watts: number | null; device_watts: boolean | null; zone_seconds: number[] | null; sport_type: string | null };
  const acts = (actR.data ?? []) as unknown as Act[];
  const zoneMin = (week: number, pick: (z: number[]) => number): number =>
    Math.round(acts.filter((a) => a.zone_seconds && weekOf(a.local_date) === week).reduce((t, a) => t + pick(a.zone_seconds!), 0) / 60);
  const exercises = (exR.data ?? []) as { id: string; name: string; bw_factor: number | null; bw_basis: string | null }[];
  const weights = ((wR.data ?? []) as { date: string; weight_lb: number }[]).map((w) => ({ date: w.date, lb: Number(w.weight_lb) }));

  const planDay = new Map<string, PlanDay>(days.map((d) => [d.id, d]));
  const weekOf = (date: string) => Math.floor(dayIndex(start, date) / 7) + 1;
  const nWeeks = Math.min(4, Math.max(1, Math.floor(Math.max(idxToday, 0) / 7) + 1));
  const weekLabels = Array.from({ length: nWeeks }, (_, i) => `W${i + 1}`);

  // Active days and streak
  const activeDates = new Set(sessions.filter((s) => ACTIVE.has(s.status)).map((s) => s.date));
  const logDates = new Set([...logs.manual.keys(), ...logs.strava.keys()]);
  for (const d of logDates) if (activeFromLogs(d, logs.manual, logs.strava)) activeDates.add(d);
  let streak = 0;
  let cursor = activeDates.has(today) ? today : addDays(today, -1);
  while (activeDates.has(cursor)) { streak++; cursor = addDays(cursor, -1); }

  const activeDays: Bar[] = weekLabels.map((label, i) => ({
    label,
    value: [...activeDates].filter((d) => weekOf(d) === i + 1 && dayIndex(start, d) >= 0 && dayIndex(start, d) < 28).length,
  }));
  const fullDone = sessions.filter((s) => s.status === "done").length;
  const elapsed = Math.max(0, Math.min(28, idxToday + 1));
  const thisWeek = activeDays[nWeeks - 1]?.value ?? 0;
  const daysInThisWeek = Math.max(0, Math.min(7, idxToday - (nWeeks - 1) * 7 + 1));

  // Active minutes per week, from what was actually checked off
  const checksBySession = new Map<string, Chk[]>();
  for (const c of checks) checksBySession.set(c.session_id, [...(checksBySession.get(c.session_id) ?? []), c]);
  const minutesFor = (s: Sess): number => {
    const day = s.plan_day_id ? planDay.get(s.plan_day_id) : undefined;
    const cs = checksBySession.get(s.id) ?? [];
    if (!day) return s.status === "minimum" ? 10 : 0;
    let m = 0;
    day.steps.forEach((st, idx) => {
      if (st.type === "round") {
        const items = day.plan_item.filter((p) => p.round_no === st.n);
        const total = items.reduce((t, p) => t + p.sets, 0) || 1;
        const done = cs.filter((c) => c.kind === "set" && items.some((p) => p.id === c.ref)).length;
        m += st.min * Math.min(1, done / total);
      } else if (cs.some((c) => c.kind === "step" && c.ref === String(idx))) m += st.min;
    });
    if (m === 0) return s.status === "minimum" ? 10 : s.status === "done" ? day.minutes_est : 0;
    return Math.round(m);
  };
  const minutes: Bar[] = weekLabels.map((label, i) => ({
    label,
    value:
      sessions.filter((s) => ACTIVE.has(s.status) && weekOf(s.date) === i + 1).reduce((t, s) => t + minutesFor(s), 0) +
      [...logs.manual.entries()].filter(([d]) => weekOf(d) === i + 1).reduce((t, [, a]) => t + a.minutes, 0) +
      [...logs.strava.entries()].filter(([d]) => weekOf(d) === i + 1).reduce((t, [, a]) => t + a.unmatchedMinutes, 0),
  }));

  // Strength: effective load = body weight x exercise factor + weight added
  const weightOn = (date: string): number | null => {
    if (!weights.length) return null;
    const before = weights.filter((w) => w.date <= date);
    return (before.length ? before[before.length - 1] : weights[0]).lb;
  };
  const sessDate = new Map(sessions.map((s) => [s.id, s.date]));
  const setRows = checks.filter((c) => c.kind === "set");
  const effOf = (c: Chk, date: string) => {
    const w = weightOn(date);
    return (c.bw_factor && w ? Number(c.bw_factor) * w : 0) + Number(c.load_lb ?? 0);
  };
  const needsWeight = weights.length === 0 && (setRows.some((c) => c.bw_factor) || manualStrength.some((a) => a.activity_set?.some((x) => x.bw_factor)));
  const setsWeekly: Bar[] = weekLabels.map((label, i) => ({
    label,
    value:
      setRows.filter((c) => weekOf(sessDate.get(c.session_id) ?? start) === i + 1).length +
      manualStrength.filter((a) => weekOf(a.date) === i + 1).reduce((t, a) => t + (a.activity_set?.length ?? 0), 0),
  }));
  const volumeWeekly: Bar[] = weekLabels.map((label, i) => ({
    label,
    value: Math.round(
      setRows
        .filter((c) => weekOf(sessDate.get(c.session_id) ?? start) === i + 1 && c.reps && itemInfo.get(c.ref)?.unit !== "seconds")
        .reduce((t, c) => t + (c.reps as number) * effOf(c, sessDate.get(c.session_id) ?? start), 0) +
      manualStrength
        .filter((a) => weekOf(a.date) === i + 1 && a.exercise?.unit !== "seconds")
        .reduce((t, a) => t + (a.activity_set ?? []).reduce((u, x) => u + x.reps * effOf({ bw_factor: x.bw_factor, load_lb: x.load_lb } as Chk, a.date), 0), 0),
    ),
  }));

  // Effort mix
  const effort: Stack[] = weekLabels.map((label, i) => {
    const rs = results.filter((r) => weekOf(sessDate.get(r.session_id) ?? start) === i + 1);
    return {
      label,
      easy: rs.filter((r) => r.rating === "easy").length,
      average: rs.filter((r) => r.rating === "average").length,
      hard: rs.filter((r) => r.rating === "hard").length,
    };
  });

  // Per-exercise best set per session, compared on effective load
  type Top = { date: string; eff: number; reps: number; factor: boolean; hold: boolean };
  const best = new Map<string, Map<string, Top>>();
  const better = (a: Top, b: Top) =>
    a.eff > b.eff * 1.02 || (Math.abs(a.eff - b.eff) <= b.eff * 0.02 && a.reps > b.reps);
  for (const c of setRows) {
    const info = itemInfo.get(c.ref);
    const date = sessDate.get(c.session_id);
    if (!info || !date || c.reps == null) continue;
    const t: Top = { date, eff: effOf(c, date), reps: c.reps, factor: !!c.bw_factor, hold: info.unit === "seconds" };
    const per = best.get(info.name) ?? new Map<string, Top>();
    const cur = per.get(date);
    if (!cur || better(t, cur)) per.set(date, t);
    best.set(info.name, per);
  }
  for (const a of manualStrength) {
    if (!a.exercise) continue;
    for (const x of a.activity_set ?? []) {
      const t: Top = {
        date: a.date, eff: effOf({ bw_factor: x.bw_factor, load_lb: x.load_lb } as Chk, a.date),
        reps: x.reps, factor: !!x.bw_factor, hold: a.exercise.unit === "seconds",
      };
      const per = best.get(a.exercise.name) ?? new Map<string, Top>();
      const cur = per.get(a.date);
      if (!cur || better(t, cur)) per.set(a.date, t);
      best.set(a.exercise.name, per);
    }
  }
  const fmtTop = (t: Top) =>
    t.hold ? `${t.reps} s` : t.eff > 0 ? `${t.factor ? "≈" : ""}${Math.round(t.eff)} lb × ${t.reps}` : `${t.reps} reps`;
  const score = (t: Top) => (t.hold || t.eff === 0 ? t.reps : Math.round(t.eff * (1 + t.reps / 30) * 10) / 10);
  const improvements: Bar[] = weekLabels.map((label) => ({ label, value: 0 }));
  const exerciseRows = [...best.entries()].map(([name, per]) => {
    const list = [...per.values()].sort((a, b) => a.date.localeCompare(b.date));
    let run = list[0];
    for (const t of list.slice(1)) {
      if (better(t, run)) {
        run = t;
        const w = weekOf(t.date) - 1;
        if (improvements[w]) improvements[w].value += 1;
      }
    }
    return {
      name, n: list.length, first: fmtTop(list[0]), latest: fmtTop(list[list.length - 1]),
      up: better(list[list.length - 1], list[0]), trend: list.map(score),
    };
  });

  // Cardio from Strava
  const z2Weekly: Bar[] = weekLabels.map((label, i) => ({ label, value: zoneMin(i + 1, (z) => z[1]) }));
  const z3Weekly: Bar[] = weekLabels.map((label, i) => ({ label, value: zoneMin(i + 1, (z) => z[2] + z[3] + z[4]) }));
  const hrPts: Pt[] = acts.filter((a) => a.avg_hr).map((a) => ({ x: dayIndex(start, a.local_date), y: Math.round(Number(a.avg_hr)), label: shortLabel(a.local_date) }));
  const wattPts: Pt[] = acts.filter((a) => a.avg_watts && a.device_watts).map((a) => ({ x: dayIndex(start, a.local_date), y: Math.round(Number(a.avg_watts)), label: shortLabel(a.local_date) }));
  const sameWorkout = (() => {
    const g = new Map<string, Act[]>();
    for (const a of acts.filter((x) => x.avg_hr && x.name && /ride/i.test(x.sport_type ?? ""))) g.set(a.name!, [...(g.get(a.name!) ?? []), a]);
    return [...g.entries()].filter(([, l]) => l.length > 1).map(([name, l]) => ({
      name, n: l.length, first: Math.round(Number(l[0].avg_hr)), latest: Math.round(Number(l[l.length - 1].avg_hr)),
    }));
  })();

  // Weight
  const wPts: Pt[] = weights.map((w) => ({ x: dayIndex(start, w.date), y: w.lb, label: shortLabel(w.date) }));
  const wAvg: Pt[] = weights.map((w, i) => {
    const x = dayIndex(start, w.date);
    const win = weights.filter((o) => dayIndex(start, o.date) <= x && dayIndex(start, o.date) > x - 7);
    return { x, y: Math.round((win.reduce((t, o) => t + o.lb, 0) / win.length) * 10) / 10, label: shortLabel(w.date) + (i ? "" : "") };
  });
  const wChange = weights.length > 1 ? Math.round((weights[weights.length - 1].lb - weights[0].lb) * 10) / 10 : null;

  const empty = sessions.every((s) => s.status === "planned");

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="text-4xl font-semibold tracking-tight">Progress</h1>
      <p className="mt-1 text-sm text-muted">Block 1, through {shortLabel(today)}.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Active day streak" value={`${streak}`} sub="days in a row" />
        <Stat label="This week" value={`${thisWeek} of ${daysInThisWeek}`} sub="days active" />
        <Stat label="Sessions fully done" value={`${fullDone}`} sub={`of ${elapsed} days so far`} />
        <Stat
          label="Weight"
          value={weights.length ? `${weights[weights.length - 1].lb} lb` : "No entry"}
          sub={wChange == null ? "Enter on Today" : `${wChange > 0 ? "+" : ""}${wChange} lb since ${shortLabel(weights[0].date)}`}
        />
      </div>

      {empty && (
        <p className="mt-4 rounded-2xl border border-line bg-card p-4 text-sm text-muted">
          No sessions logged yet. Charts fill in as you log.
        </p>
      )}

      <Card title="Active days per week" sub={`A planned session (done, partly done or minimum), any logged activity with sets, or any walk, run or ride of ${MIN_ACTIVE_MIN} minutes or more counts as active. Goal: 7.`}>
        <BarChart data={activeDays} unit="days" title="Active days per week" />
      </Card>
      <Card title="Active minutes per week" sub="Minutes of the checked-off steps and sets, not the planned total.">
        <BarChart data={minutes} unit="min" title="Active minutes per week" />
      </Card>
      <Card title="Strength sets completed" sub="Every set you checked off, per week, loaded or bodyweight.">
        <BarChart data={setsWeekly} unit="sets" title="Strength sets completed per week" />
      </Card>
      <Card title="Strength improvements" sub="Exercises where your best set beat every earlier session on effective load, reps or hold time. A harder variation counts when you change that exercise's factor or switch to it. Changes under 2% are ignored.">
        <BarChart data={improvements} unit="improvements" title="Strength improvements per week" />
      </Card>
      <Card title="Strength volume (effective lb)" sub="Reps × effective load for rep-based sets. Effective load = body weight × the exercise's factor + weight added. Holds are excluded.">
        <BarChart data={volumeWeekly} unit="lb" title="Strength volume per week, effective load" />
        {needsWeight && <p className="mt-2 text-xs text-danger">Enter your weight on Today. Bodyweight moves count as zero until you do.</p>}
      </Card>
      <Card title="Effort mix" sub="How you rated each exercise. As easy ratings pile up, the app proposes more (step 4).">
        <StackedBars data={effort} title="Exercise effort ratings per week" />
      </Card>

      <Card title="Weight" sub="Daily entries with a 7-day average.">
        {wPts.length >= 2 ? (
          <LineChart points={wPts} avg={wAvg} unit="lb" title="Weight" />
        ) : (
          <p className="text-sm text-muted">Enter your weight on Today. The chart draws after two entries.</p>
        )}
      </Card>

      <Card title="Lifts: first vs latest best set" sub="Best set per session on effective load (≈ means body weight is included). Reps if no load, seconds for holds.">
        {exerciseRows.length === 0 ? (
          <p className="text-sm text-muted">Log sets to see lift progress.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-medium">Exercise</th><th className="font-medium">First</th><th className="font-medium">Latest</th><th className="font-medium"><span className="sr-only">Trend</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {exerciseRows.map((r) => (
                <tr key={r.name}>
                  <td className="py-2 pr-2 leading-snug">{r.name.replace(/,.*$/, "")}</td>
                  <td className="pr-2 text-muted">{r.first}</td>
                  <td className="pr-2">{r.n > 1 ? r.latest : "·"}{r.n > 1 && r.up ? " ↑" : ""}</td>
                  <td><Spark values={r.trend} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Bodyweight factors" sub="Fraction of your body weight each move carries (0.70 is a standard push-up; blank = only added weight counts). Study values: standard push-up 0.69 to 0.75, knee push-up 0.54 to 0.62. Everything else is an estimate. A change applies to sets logged from now on, so lower the incline push-up factor to its next bench setting when you steepen or flatten the bench.">
        <FactorEditor rows={exercises} />
      </Card>

      <Card title="Time in Z2 (minutes per week)" sub="Easy aerobic work. Heart-rate zones come from your Strava rides.">
        {acts.length ? <BarChart data={z2Weekly} unit="min" title="Minutes in Z2 per week" /> : <p className="text-sm text-muted">Connect Strava in Settings to fill this in.</p>}
      </Card>
      {acts.length > 0 && (
        <>
          <Card title="Time in Z3 or higher (minutes per week)" sub="Steady and hard work. Z4 and Z5 come from the interval days.">
            <BarChart data={z3Weekly} unit="min" title="Minutes in Z3 or higher per week" />
          </Card>
          {hrPts.length >= 2 && (
            <Card title="Average heart rate per ride" sub="Same effort at a lower heart rate means fitness is rising. Compare like with like.">
              <LineChart points={hrPts} unit="bpm" title="Average heart rate per ride" />
            </Card>
          )}
          {sameWorkout.length > 0 && (
            <Card title="Same workout, first vs latest" sub="Average HR on rides with the same name.">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Ride</th><th className="font-medium">First</th><th className="font-medium">Latest</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {sameWorkout.map((r) => (
                    <tr key={r.name}><td className="py-2 pr-2 leading-snug">{r.name}</td><td className="pr-2 text-muted">{r.first}</td><td>{r.latest}{r.latest < r.first ? " ↓" : ""}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {wattPts.length >= 2 && (
            <Card title="Average power per ride" sub="Measured by the Kickr Core. FTP retest is in Week 3.">
              <LineChart points={wattPts} unit="W" title="Average power per ride" />
            </Card>
          )}
        </>
      )}
      <Card title="Still to come" sub="Resting heart rate trend (weekly entry) arrives with the weekly review in step 8.">
        <p className="text-sm text-muted">Change max and resting HR in Settings. Zones update from the next ride.</p>
      </Card>
    </main>
  );
}
