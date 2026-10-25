import { createClient } from "@/lib/supabase/server";
import { ensurePlan } from "@/lib/seed-plan";

const TZ = "America/New_York";

export const dynamic = "force-dynamic";

type Step =
  | { type: "step" | "station"; label: string; min: number; note: string }
  | { type: "round"; n: number; min: number };

type PlanItem = {
  round_no: number;
  ord: number;
  sets: number;
  rep_min: number | null;
  rep_max: number | null;
  hold_min_s: number | null;
  hold_max_s: number | null;
  per_side: boolean;
  load_text: string;
  exercise: { name: string } | null;
};

type PlanDay = {
  id: string;
  week_no: number;
  day_no: number;
  session_kind: string;
  title: string;
  minutes_est: number;
  steps: Step[];
  plan_item: PlanItem[];
};

function todayIso(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayIndex(startIso: string, todayIsoStr: string): number {
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ty, tm, td] = todayIsoStr.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86400000);
}

function reps(i: PlanItem): string {
  const side = i.per_side ? " per side" : "";
  if (i.hold_min_s != null) {
    const h = i.hold_max_s && i.hold_max_s !== i.hold_min_s ? `${i.hold_min_s} to ${i.hold_max_s}` : `${i.hold_min_s}`;
    return `${i.sets} × ${h} s${side}`;
  }
  const r = i.rep_max && i.rep_max !== i.rep_min ? `${i.rep_min} to ${i.rep_max}` : `${i.rep_min}`;
  return `${i.sets} × ${r}${side}`;
}

const SELECT =
  "id,week_no,day_no,session_kind,title,minutes_est,steps," +
  "plan_item(round_no,ord,sets,rep_min,rep_max,hold_min_s,hold_max_s,per_side,load_text,exercise:exercise_id(name))";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: TZ,
  }).format(new Date());

  let message: string | null = null;
  let today: PlanDay | null = null;
  let tomorrow: PlanDay | null = null;

  if (user) {
    try {
      await ensurePlan(supabase, user.id);
      const { data: settings } = await supabase
        .from("settings").select("plan_start_date").maybeSingle();
      const start = settings?.plan_start_date as string | undefined;
      if (!start) {
        message = "No settings row found for this account.";
      } else {
        const idx = dayIndex(start, todayIso());
        if (idx < 0) {
          message = `Your plan starts ${start}.`;
        } else if (idx >= 28) {
          message = "Block 1 is complete. The next block loads in a later build step.";
        } else {
          const want = [idx, idx + 1].filter((n) => n < 28);
          const keys = want.map((n) => ({ week: Math.floor(n / 7) + 1, day: (n % 7) + 1 }));
          const { data } = await supabase
            .from("plan_day").select(SELECT)
            .in("week_no", [...new Set(keys.map((k) => k.week))])
            .in("day_no", [...new Set(keys.map((k) => k.day))]);
          const rows = (data ?? []) as unknown as PlanDay[];
          const find = (k?: { week: number; day: number }) =>
            k ? rows.find((r) => r.week_no === k.week && r.day_no === k.day) ?? null : null;
          today = find(keys[0]);
          tomorrow = find(keys[1]);
          if (!today) message = "Today's session was not found in the plan.";
        }
      }
    } catch (e) {
      message = `Could not load the plan: ${e instanceof Error ? e.message : "unknown error"}`;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[max(env(safe-area-inset-top),1.5rem)]">
      <p className="text-sm font-medium text-muted">{dateLabel}</p>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">Today</h1>

      {message && (
        <section className="mt-8 rounded-2xl border border-line bg-card p-5">
          <p className="text-sm leading-relaxed text-muted">{message}</p>
        </section>
      )}

      {today && (
        <section className="mt-8 rounded-2xl border border-line bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Week {today.week_no} · Day {today.day_no} · about {today.minutes_est} min
          </p>
          <h2 className="mt-1 text-xl font-semibold">{today.title}</h2>
          <ol className="mt-4 space-y-4">
            {today.steps.map((s, i) => {
              if (s.type === "round") {
                const items = today!.plan_item
                  .filter((p) => p.round_no === s.n)
                  .sort((a, b) => a.ord - b.ord);
                return (
                  <li key={i}>
                    <p className="text-sm font-semibold">Round {s.n}</p>
                    <ul className="mt-1 space-y-1.5">
                      {items.map((it, j) => (
                        <li key={j} className="text-sm leading-snug">
                          <span className="font-medium">{it.exercise?.name}</span>
                          <span className="text-muted">
                            {" "}
                            · {reps(it)}
                            {it.load_text ? ` · ${it.load_text}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              }
              return (
                <li key={i}>
                  <p className="text-sm font-semibold">
                    {s.label} <span className="font-normal text-muted">· {s.min} min</span>
                  </p>
                  {s.note && <p className="mt-0.5 text-sm leading-snug text-muted">{s.note}</p>}
                </li>
              );
            })}
          </ol>
          <p className="mt-5 text-xs leading-relaxed text-muted">
            Bad day: 10 minutes of anything counts. Zero is the only miss.
          </p>
        </section>
      )}

      {tomorrow && (
        <p className="mt-4 text-sm text-muted">Tomorrow: {tomorrow.title}</p>
      )}

      <footer className="mt-auto pt-10">
        <p className="text-xs text-muted">Signed in as {user?.email}</p>
        <form action="/auth/signout" method="post" className="mt-1">
          <button type="submit" className="min-h-11 text-sm text-muted underline underline-offset-4">
            Sign out
          </button>
        </form>
      </footer>
    </main>
  );
}
