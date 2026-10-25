import { createClient } from "@/lib/supabase/server";
import { addDays, dayIndex, shortLabel, todayIso } from "@/lib/dates";
import { loadAllPlanDays, type PlanDay } from "@/lib/plan";
import { BarChart, LineChart, Spark, StackedBars, type Bar, type Pt, type Stack } from "@/components/charts";

export const dynamic = "force-dynamic";

type Sess = { id: string; date: string; plan_day_id: string | null; status: string };
type Chk = { session_id: string; kind: string; ref: string; set_no: number; done: boolean; reps: number | null; load_lb: number | null };

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

  const [days, sessR, chkR, resR, itemR, wR] = await Promise.all([
    loadAllPlanDays(supabase),
    supabase.from("session").select("id,date,plan_day_id,status"),
    supabase.from("check_log").select("session_id,kind,ref,set_no,done,reps,load_lb").eq("done", true),
    supabase.from("exercise_result").select("session_id,rating"),
    supabase.from("plan_item").select("id,exercise:exercise_id(name)"),
    supabase.from("weight_log").select("date,weight_lb").order("date"),
  ]);
  const sessions = (sessR.data ?? []) as Sess[];
  const checks = (chkR.data ?? []) as Chk[];
  const results = (resR.data ?? []) as { session_id: string; rating: "easy" | "average" | "hard" }[];
  const itemName = new Map(
    ((itemR.data ?? []) as unknown as { id: string; exercise: { name: string } | null }[]).map((i) => [i.id, i.exercise?.name ?? "?"]),
  );
  const weights = ((wR.data ?? []) as { date: string; weight_lb: number }[]).map((w) => ({ date: w.date, lb: Number(w.weight_lb) }));

  const planDay = new Map<string, PlanDay>(days.map((d) => [d.id, d]));
  const weekOf = (date: string) => Math.floor(dayIndex(start, date) / 7) + 1;
  const nWeeks = Math.min(4, Math.max(1, Math.floor(Math.max(idxToday, 0) / 7) + 1));
  const weekLabels = Array.from({ length: nWeeks }, (_, i) => `W${i + 1}`);

  // Active days and streak
  const activeDates = new Set(sessions.filter((s) => ACTIVE.has(s.status)).map((s) => s.date));
  let streak = 0;
  let cursor = activeDates.has(today) ? today : addDays(today, -1);
  while (activeDates.has(cursor)) { streak++; cursor = addDays(cursor, -1); }

  const activeDays: Bar[] = weekLabels.map((label, i) => ({
    label,
    value: sessions.filter((s) => ACTIVE.has(s.status) && weekOf(s.date) === i + 1).length,
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
    value: sessions.filter((s) => ACTIVE.has(s.status) && weekOf(s.date) === i + 1).reduce((t, s) => t + minutesFor(s), 0),
  }));

  // Strength sets
  const sessDate = new Map(sessions.map((s) => [s.id, s.date]));
  const setRows = checks.filter((c) => c.kind === "set");
  const setsWeekly: Bar[] = weekLabels.map((label, i) => ({
    label,
    value: setRows.filter((c) => weekOf(sessDate.get(c.session_id) ?? start) === i + 1).length,
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

  // Per-exercise first vs latest best set
  type Top = { date: string; load: number; reps: number };
  const best = new Map<string, Map<string, Top>>();
  for (const c of setRows) {
    const name = itemName.get(c.ref);
    const date = sessDate.get(c.session_id);
    if (!name || !date || c.reps == null) continue;
    const t: Top = { date, load: Number(c.load_lb ?? 0), reps: c.reps };
    const per = best.get(name) ?? new Map<string, Top>();
    const cur = per.get(date);
    if (!cur || t.load > cur.load || (t.load === cur.load && t.reps > cur.reps)) per.set(date, t);
    best.set(name, per);
  }
  const fmtTop = (t: Top, unit: string) => (t.load ? `${t.load} lb × ${t.reps}` : `${t.reps}${unit}`);
  const better = (a: Top, b: Top) => a.load > b.load || (a.load === b.load && a.reps > b.reps);
  const improvements: Bar[] = weekLabels.map((label) => ({ label, value: 0 }));
  const exerciseRows = [...best.entries()].map(([name, per]) => {
    const list = [...per.values()].sort((a, b) => a.date.localeCompare(b.date));
    const unit = /plank|carry/i.test(name) ? " s" : " reps";
    let run = list[0];
    for (const t of list.slice(1)) {
      if (better(t, run)) {
        run = t;
        const w = weekOf(t.date) - 1;
        if (improvements[w]) improvements[w].value += 1;
      }
    }
    const score = (t: Top) => (t.load ? Math.round(t.load * (1 + t.reps / 30) * 10) / 10 : t.reps);
    return {
      name, n: list.length, first: fmtTop(list[0], unit), latest: fmtTop(list[list.length - 1], unit),
      up: better(list[list.length - 1], list[0]), trend: list.map(score),
    };
  });

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

      <Card title="Active days per week" sub="Done, partly done or minimum day counts as active. Goal: 7.">
        <BarChart data={activeDays} unit="days" title="Active days per week" />
      </Card>
      <Card title="Active minutes per week" sub="Minutes of the checked-off steps and sets, not the planned total.">
        <BarChart data={minutes} unit="min" title="Active minutes per week" />
      </Card>
      <Card title="Strength sets completed" sub="Every set you checked off, per week, loaded or bodyweight.">
        <BarChart data={setsWeekly} unit="sets" title="Strength sets completed per week" />
      </Card>
      <Card title="Strength improvements" sub="Exercises where your best set beat every earlier session: more weight, more reps at the same weight, or a longer hold. Adding load to a bodyweight move counts.">
        <BarChart data={improvements} unit="improvements" title="Strength improvements per week" />
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

      <Card title="Lifts: first vs latest best set" sub="Heaviest set per session (reps if no weight, seconds for holds). The line shows each session's best set.">
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

      <Card title="Added after Strava is linked" sub="Step 5. These need the heart-rate and power data from your rides.">
        <ul className="space-y-2 text-sm">
          <li><span className="font-medium">Time in zone per week.</span> <span className="text-muted">Minutes in Z2, Z3 and Z4 or higher.</span></li>
          <li><span className="font-medium">Average HR on the same Zwift workout.</span> <span className="text-muted">Lower HR at the same effort means fitness is rising.</span></li>
          <li><span className="font-medium">Power and FTP.</span> <span className="text-muted">Average power by ride, and the Week 3 Ramp Test result.</span></li>
          <li><span className="font-medium">Resting HR.</span> <span className="text-muted">Entered weekly; the trend is the main fitness signal.</span></li>
        </ul>
      </Card>
    </main>
  );
}
