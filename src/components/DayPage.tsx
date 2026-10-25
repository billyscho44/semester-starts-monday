import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensurePlan } from "@/lib/seed-plan";
import { PLAN_SELECT, type PlanDay, type SessionRow } from "@/lib/plan";
import { addDays, longLabel, planPosition, todayIso } from "@/lib/dates";
import DayView, { type CheckRow, type FeedbackRow, type ResultRow } from "./DayView";
import WeightCard from "./WeightCard";
import Proposals, { type ProposalRow } from "./Proposals";
import ActivityCard, { type Activity } from "./ActivityCard";
import ActivityLogger, { type ExerciseOption } from "./ActivityLogger";
import { ensureExtraExercises, type LoggedActivity } from "@/lib/activity";

export default async function DayPage({ date }: { date: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayIso();
  const isToday = date === today;
  let error: string | null = null;
  let day: PlanDay | null = null;
  let session: SessionRow | null = null;
  let checks: CheckRow[] = [];
  let results: ResultRow[] = [];
  let feedback: FeedbackRow | null = null;
  let weight: number | null = null;
  let lastWeight: { date: string; lb: number } | null = null;
  let note: string | null = null;
  let proposals: ProposalRow[] = [];
  let activities: Activity[] = [];
  let entries: LoggedActivity[] = [];
  let exerciseOptions: ExerciseOption[] = [];

  try {
    await ensurePlan(supabase, user.id);
    await ensureExtraExercises(supabase, user.id);
    const { data: settings } = await supabase.from("settings").select("plan_start_date").maybeSingle();
    const start = settings?.plan_start_date as string | undefined;
    if (!start) throw new Error("No settings row found for this account.");
    const pos = planPosition(start, date);
    if (!pos) note = date < start ? `The plan starts ${start}.` : "Block 1 ends here. The next block loads in a later build step.";
    else {
      const { data } = await supabase
        .from("plan_day").select(PLAN_SELECT).eq("week_no", pos.week).eq("day_no", pos.day).maybeSingle();
      day = (data as unknown as PlanDay) ?? null;
    }
    const { data: s } = await supabase
      .from("session").select("id,date,plan_day_id,status,miss_reason,zwift_workout").eq("date", date).maybeSingle();
    session = (s as SessionRow) ?? null;
    if (session) {
      const [c, r, f] = await Promise.all([
        supabase.from("check_log").select("kind,ref,set_no,done,reps,load_lb").eq("session_id", session.id),
        supabase.from("exercise_result").select("plan_item_id,rating,completed_all").eq("session_id", session.id),
        supabase.from("session_feedback")
          .select("overall,completion,energy_before,pain_flag,pain_area,note").eq("session_id", session.id).maybeSingle(),
      ]);
      checks = (c.data ?? []) as CheckRow[];
      results = (r.data ?? []) as ResultRow[];
      feedback = (f.data as FeedbackRow) ?? null;
    }
    const { data: acts } = await supabase
      .from("strava_activity")
      .select("id,name,sport_type,moving_s,distance_m,avg_hr,max_hr,avg_watts,device_watts,zone_seconds,perceived_exertion,suffer_score:raw->>suffer_score")
      .eq("local_date", date).order("started_at");
    activities = (acts ?? []) as unknown as Activity[];
    const [logR, exR] = await Promise.all([
      supabase
        .from("activity_log")
        .select("id,date,kind,label,minutes,distance_mi,note,exercise:exercise_id(id,name,unit,bw_factor),activity_set(set_no,reps,load_lb)")
        .eq("date", date).order("created_at"),
      supabase.from("exercise").select("id,name,unit,bw_factor").eq("type", "strength").order("name"),
    ]);
    entries = ((logR.data ?? []) as unknown as (Omit<LoggedActivity, "sets"> & { activity_set: { set_no: number; reps: number; load_lb: number | null }[] })[]).map((r) => ({
      id: r.id, date: r.date, kind: r.kind, label: r.label,
      minutes: r.minutes, distance_mi: r.distance_mi != null ? Number(r.distance_mi) : null, note: r.note,
      exercise: r.exercise ? { ...r.exercise, bw_factor: r.exercise.bw_factor != null ? Number(r.exercise.bw_factor) : null } : null,
      sets: [...(r.activity_set ?? [])].sort((a, b) => a.set_no - b.set_no).map((x) => ({ set_no: x.set_no, reps: x.reps, load_lb: x.load_lb != null ? Number(x.load_lb) : null })),
    }));
    exerciseOptions = ((exR.data ?? []) as unknown as ExerciseOption[]).map((e) => ({ ...e, bw_factor: e.bw_factor != null ? Number(e.bw_factor) : null }));
    const PSEL = "id,kind,summary,reason,status,new_target_reps,new_target_load_lb,session_id";
    const [pend, mine] = await Promise.all([
      isToday
        ? supabase.from("proposal").select(PSEL).eq("status", "pending").order("created_at")
        : Promise.resolve({ data: [] }),
      session ? supabase.from("proposal").select(PSEL).eq("session_id", session.id).order("created_at") : Promise.resolve({ data: [] }),
    ]);
    const seen = new Set<string>();
    proposals = [...(mine.data ?? []), ...(pend.data ?? [])].filter((p) => {
      const id = (p as { id: string }).id;
      return seen.has(id) ? false : (seen.add(id), true);
    }) as unknown as ProposalRow[];
    if (isToday) {
      const { data: w } = await supabase
        .from("weight_log").select("date,weight_lb").order("date", { ascending: false }).limit(2);
      const rows = (w ?? []) as { date: string; weight_lb: number }[];
      const todayRow = rows.find((x) => x.date === date);
      weight = todayRow ? Number(todayRow.weight_lb) : null;
      const prev = rows.find((x) => x.date !== date);
      lastWeight = prev ? { date: prev.date, lb: Number(prev.weight_lb) } : null;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load this day.";
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="flex items-center justify-between text-sm text-muted">
        <Link href={`/day/${addDays(date, -1)}`} className="flex min-h-11 items-center pr-3" aria-label="Previous day">← Prev</Link>
        {!isToday && <Link href="/" className="flex min-h-11 items-center text-accent">Back to today</Link>}
        <Link href={`/day/${addDays(date, 1)}`} className="flex min-h-11 items-center pl-3" aria-label="Next day">Next →</Link>
      </div>
      <p className="text-sm font-medium text-muted">{longLabel(date)}</p>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">{isToday ? "Today" : "Day"}</h1>

      {error && (
        <section className="mt-6 rounded-2xl border border-line bg-card p-5">
          <p className="text-sm text-danger" role="alert">Could not load: {error}</p>
        </section>
      )}
      {note && (
        <section className="mt-6 rounded-2xl border border-line bg-card p-5">
          <p className="text-sm text-muted">{note}</p>
        </section>
      )}

      {!error && !note && activities.map((a) => <ActivityCard key={a.id} a={a} />)}

      {!error && !note && proposals.length > 0 && <Proposals rows={proposals} title="Next time" />}

      {!error && !note && (
        <DayView
          key={date}
          userId={user.id}
          date={date}
          editable={date <= today}
          day={day}
          session={session}
          checks={checks}
          results={results}
          feedback={feedback}
          swapped={entries.length > 0 || activities.some((a) => (a.moving_s ?? 0) >= 600)}
        />
      )}

      {!error && !note && (
        <ActivityLogger userId={user.id} date={date} editable={date <= today} exercises={exerciseOptions} entries={entries} />
      )}

      {isToday && !error && <WeightCard userId={user.id} date={date} initial={weight} last={lastWeight} />}

      <footer className="mt-10 pb-4">
        <p className="text-xs text-muted">Signed in as {user.email} · <Link href="/settings" className="underline underline-offset-4">Settings</Link></p>
        <form action="/auth/signout" method="post" className="mt-1">
          <button type="submit" className="min-h-11 text-sm text-muted underline underline-offset-4">Sign out</button>
        </form>
      </footer>
    </main>
  );
}
