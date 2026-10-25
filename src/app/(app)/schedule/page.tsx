import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensurePlan } from "@/lib/seed-plan";
import { loadAllPlanDays } from "@/lib/plan";
import { addDays, shortLabel, todayIso } from "@/lib/dates";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  done: "Done", partial: "Partly", minimum: "Minimum", skipped: "Skipped",
};

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  await ensurePlan(supabase, user.id);
  const { data: settings } = await supabase.from("settings").select("plan_start_date").maybeSingle();
  const start = (settings?.plan_start_date as string) ?? todayIso();
  const [days, sessions] = await Promise.all([
    loadAllPlanDays(supabase),
    supabase.from("session").select("date,status").gte("date", start).lte("date", addDays(start, 27)),
  ]);
  const status = new Map((sessions.data ?? []).map((s) => [s.date as string, s.status as string]));
  const today = todayIso();

  const weeks = [1, 2, 3, 4].map((w) => days.filter((d) => d.week_no === w));

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="text-4xl font-semibold tracking-tight">Schedule</h1>
      <p className="mt-1 text-sm text-muted">Block 1, four weeks. Week 4 is a lighter deload.</p>
      {weeks.map((list, w) => (
        <section key={w} className="mt-6">
          <h2 className="text-sm font-semibold text-muted">Week {w + 1}{w === 3 ? " · deload" : ""}</h2>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-card">
            {list.map((d) => {
              const date = addDays(start, w * 7 + d.day_no - 1);
              const st = status.get(date);
              const isToday = date === today;
              return (
                <li key={d.id}>
                  <Link href={isToday ? "/" : `/day/${date}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0">
                      <span className={`block text-xs ${isToday ? "font-semibold text-accent" : "text-muted"}`}>
                        {isToday ? "Today · " : ""}{shortLabel(date)} · {d.minutes_est} min
                      </span>
                      <span className="block truncate text-sm">{d.title.replace(" (deload)", "")}</span>
                    </span>
                    {st && st !== "planned" ? (
                      <span className="shrink-0 rounded-full border border-accent px-2 py-0.5 text-xs text-accent">{BADGE[st]}</span>
                    ) : date < today ? (
                      <span className="shrink-0 text-xs text-muted">Open</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
