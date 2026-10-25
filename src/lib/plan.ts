import type { SupabaseClient } from "@supabase/supabase-js";

export type Step =
  | { type: "step" | "station"; label: string; min: number; note: string }
  | { type: "round"; n: number; min: number };

export type PlanItem = {
  id: string;
  round_no: number;
  ord: number;
  sets: number;
  rep_min: number | null;
  rep_max: number | null;
  hold_min_s: number | null;
  hold_max_s: number | null;
  per_side: boolean;
  load_text: string;
  target_reps: number | null;
  target_load_lb: number | null;
  target_hold_s: number | null;
  exercise: { name: string; bw_factor: number | null } | null;
};

export type PlanDay = {
  id: string;
  week_no: number;
  day_no: number;
  session_kind: "strength" | "cardio" | "recovery";
  title: string;
  minutes_est: number;
  steps: Step[];
  plan_item: PlanItem[];
};

export type SessionRow = {
  id: string;
  date: string;
  plan_day_id: string | null;
  status: "planned" | "done" | "partial" | "minimum" | "skipped";
  miss_reason: string | null;
  zwift_workout: string | null;
};

export const PLAN_SELECT =
  "id,week_no,day_no,session_kind,title,minutes_est,steps," +
  "plan_item(id,round_no,ord,sets,rep_min,rep_max,hold_min_s,hold_max_s,per_side,load_text,target_reps,target_load_lb,target_hold_s,exercise:exercise_id(name,bw_factor))";

export const PLAN_DAYS = 28;

export async function loadAllPlanDays(supabase: SupabaseClient): Promise<PlanDay[]> {
  const { data } = await supabase.from("plan_day").select(PLAN_SELECT).order("week_no").order("day_no");
  return (data ?? []) as unknown as PlanDay[];
}

/** Count the planned sets/steps a day contains (used for completion math). */
export function plannedUnits(day: PlanDay): number {
  const sets = day.plan_item.reduce((t, i) => t + i.sets, 0);
  const steps = day.steps.filter((s) => s.type !== "round").length;
  return sets + steps;
}
