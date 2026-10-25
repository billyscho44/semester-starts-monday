import type { SupabaseClient } from "@supabase/supabase-js";

type Step =
  | { type: "step" | "station"; label: string; min: number; note: string }
  | { type: "round"; n: number; min: number };

type Item = [
  name: string,
  sets: number,
  repMin: number | null,
  repMax: number | null,
  holdMin: number | null,
  holdMax: number | null,
  perSide: boolean,
  load: string,
];

const EX: Record<string, [string, string, string]> = {
  "Chair squat": ["strength", "squat", "reps"],
  "DB Romanian deadlift": ["strength", "hinge", "reps"],
  "Reverse lunge, hand on chair": ["strength", "lunge", "reps"],
  "Glute bridge": ["strength", "hinge", "reps"],
  "Dead bug": ["strength", "core", "reps"],
  "Side plank, knees down": ["strength", "core", "seconds"],
  "Flat bench DB press": ["strength", "horizontal push", "reps"],
  "One-arm DB row, hand on bench": ["strength", "horizontal pull", "reps"],
  "Incline DB press, bench near 30°": ["strength", "horizontal push", "reps"],
  "Band pull-apart": ["strength", "horizontal pull", "reps"],
  "Seated DB shoulder press, bench near 72°": ["strength", "vertical push", "reps"],
  "Incline plank on bench": ["strength", "core", "seconds"],
  "Band Pallof press": ["strength", "core", "reps"],
  "Incline push-up on bench": ["strength", "horizontal push", "reps"],
  "Band row or pulldown": ["strength", "horizontal pull", "reps"],
  "Balance board squat": ["balance", "squat", "reps"],
  "Single-leg RDL, hand on chair": ["balance", "hinge", "reps"],
  "Decline crunch, bench near -15°": ["strength", "core", "reps"],
  "Farmer carry": ["strength", "carry", "seconds"],
};

const A: Record<number, Item[]> = {
  1: [
    ["Chair squat", 3, 8, 15, null, null, false, "Bodyweight"],
    ["DB Romanian deadlift", 3, 8, 12, null, null, false, "10 to 15 lb each hand"],
  ],
  2: [
    ["Reverse lunge, hand on chair", 2, 8, 8, null, null, true, "Bodyweight"],
    ["Glute bridge", 3, 12, 15, null, null, false, "Bodyweight"],
  ],
  3: [
    ["Dead bug", 3, 6, 6, null, null, true, "Slow"],
    ["Side plank, knees down", 2, null, null, 20, 20, true, ""],
  ],
};
const B: Record<number, Item[]> = {
  1: [
    ["Flat bench DB press", 3, 8, 12, null, null, false, "10 lb each"],
    ["One-arm DB row, hand on bench", 3, 8, 12, null, null, true, "15 lb"],
  ],
  2: [
    ["Incline DB press, bench near 30°", 2, 10, 12, null, null, false, "10 lb each"],
    ["Band pull-apart", 3, 15, 15, null, null, false, "Light band"],
  ],
  3: [
    ["Seated DB shoulder press, bench near 72°", 2, 10, 10, null, null, false, "5 to 10 lb each"],
    ["Incline plank on bench", 3, null, null, 20, 30, false, "Steep bench angle"],
    ["Band Pallof press", 2, 10, 10, null, null, true, ""],
  ],
};
const C: Record<number, Item[]> = {
  1: [
    ["Incline push-up on bench", 3, 6, 10, null, null, false, "Steep angle"],
    ["Band row or pulldown", 3, 12, 12, null, null, false, ""],
  ],
  2: [
    ["Balance board squat", 2, 10, 10, null, null, false, "Bodyweight, hold a wall or chair"],
    ["Single-leg RDL, hand on chair", 2, 6, 6, null, null, true, "Bodyweight"],
  ],
  3: [
    ["Decline crunch, bench near -15°", 3, 8, 10, null, null, false, ""],
    ["Farmer carry", 3, null, null, 30, 30, false, "20 lb each hand"],
  ],
};

const STATION = {
  sun: ["Core station", "Dead bug 6 per side, side plank on knees 20 s per side. 2 rounds, no rest between moves."],
  tue: ["Core station", "Bird dog 6 per side, forearm plank on knees 20 s. 2 rounds, no rest between moves."],
  thu: ["Balance and core station", "Balance board hold near a wall 30 s, bird dog 6 per side. 2 rounds, no rest between moves."],
} as const;

const Z = {
  warm: "Z1 to Z2 (under 132 bpm)",
  z2: "Z2 (110 to 131 bpm)",
  z23: "Z2 to Z3 (110 to 142 bpm)",
  cool: "Z1 (under 110 bpm)",
};

const HOLD = [0, 20, 30, 45, 30];

const step = (label: string, min: number, note = ""): Step => ({ type: "step", label, min, note });
const station = (k: keyof typeof STATION): Step => ({
  type: "station",
  label: STATION[k][0],
  min: 5,
  note: STATION[k][1],
});
const flex = (week: number): Step =>
  step("Flexibility", 8, `Pick the moves for what you worked. Hold ${HOLD[week]} s, 2 rounds, both sides.`);

function intervals(n: number, work: number, z5 = false): Step {
  const mins = Math.ceil((n * (work + 90)) / 60);
  return step(
    `${n} x (${work} s hard / 90 s easy)`,
    mins,
    `Hard = Z4 (143 to 154 bpm)${z5 ? ", or Z5 if comfortable" : ""}. Easy = Z1 to Z2.`,
  );
}

function cardio(week: number, key: "sun" | "tue" | "thu"): Step[] {
  if (key === "sun") {
    const r = { 1: [9, 9, 4, 3], 2: [10, 11, 4, 3], 3: [12, 12, 4, 3], 4: [8, 7, 4, 3] }[week]!;
    return [step("Warm-up", r[2], Z.warm), step("Ride", r[0], Z.z23), station("sun"), step("Ride", r[1], Z.z23), step("Cool-down", r[3], Z.cool), flex(week)];
  }
  if (key === "thu") {
    const r = { 1: [10, 10, 4, 3], 2: [13, 14, 4, 4], 3: [15, 16, 4, 5], 4: [10, 10, 4, 4] }[week]!;
    return [step("Warm-up", r[2], Z.warm), step("Ride", r[0], Z.z2), station("thu"), step("Ride", r[1], Z.z2), step("Cool-down", r[3], Z.cool), flex(week)];
  }
  const [a, b, work, z5] = {
    1: [3, 2, 45, false],
    2: [3, 3, 60, false],
    3: [4, 4, 60, true],
    4: [3, 2, 45, false],
  }[week] as [number, number, number, boolean];
  return [step("Warm-up", 5, Z.warm), intervals(a, work, z5), station("tue"), intervals(b, work, z5), step("Cool-down", 4, Z.cool), flex(week)];
}

function strength(week: number): Step[] {
  const s: Step[] = [step("Warm-up", 5, Z.warm)];
  for (const n of [1, 2, 3]) {
    s.push({ type: "round", n, min: 6 });
    s.push(step("Bike block", 3, "2 min steady in Z3 (132 to 142 bpm), then 1 min push in Z4 (143 to 154 bpm)."));
  }
  s.push(step("Cool-down", 3, Z.cool), flex(week));
  return s;
}

function recovery(week: number): Step[] {
  return [
    step("Easy bike", 15, "Z1, under 110 bpm"),
    step("Core and balance", 5, "Light: dead bug, bird dog, balance board hold near a wall."),
    step("Flexibility", 15, `All eight moves. Hold ${HOLD[week]} s, 2 rounds, both sides.`),
  ];
}

const DAYS: [number, "cardio" | "strength" | "recovery", string, string][] = [
  [1, "cardio", "Cardio: endurance", "sun"],
  [2, "strength", "Strength A: lower body and core", "A"],
  [3, "cardio", "Cardio: intervals", "tue"],
  [4, "strength", "Strength B: upper body and core", "B"],
  [5, "cardio", "Cardio: long and easy", "thu"],
  [6, "strength", "Strength C: full body, balance, core", "C"],
  [7, "recovery", "Recovery and flexibility", "rec"],
];

/** Inserts the 4-week Block 1 plan for this user if none exists yet. Safe to call repeatedly. */
export async function ensurePlan(supabase: SupabaseClient, userId: string): Promise<void> {
  const { count } = await supabase.from("plan_day").select("id", { count: "exact", head: true });
  if (count && count > 0) return;

  const { error: exErr } = await supabase.from("exercise").upsert(
    Object.entries(EX).map(([name, [type, movement_pattern, unit]]) => ({
      user_id: userId, name, type, movement_pattern, unit,
    })),
    { onConflict: "user_id,name", ignoreDuplicates: true },
  );
  if (exErr) throw new Error(`exercise seed: ${exErr.message}`);

  const { data: exRows, error: readErr } = await supabase.from("exercise").select("id,name");
  if (readErr || !exRows) throw new Error(`exercise read: ${readErr?.message}`);
  const exId = new Map(exRows.map((r) => [r.name as string, r.id as string]));

  const dayRows: Record<string, unknown>[] = [];
  for (const week of [1, 2, 3, 4]) {
    for (const [day_no, kind, title, key] of DAYS) {
      const steps =
        kind === "cardio" ? cardio(week, key as "sun" | "tue" | "thu")
        : kind === "strength" ? strength(week)
        : recovery(week);
      const minutes_est = kind === "strength" ? 43 : steps.reduce((t, s) => t + s.min, 0);
      dayRows.push({
        user_id: userId, week_no: week, day_no, session_kind: kind,
        title: week === 4 ? `${title} (deload)` : title, minutes_est, steps,
      });
    }
  }
  const { data: days, error: dayErr } = await supabase
    .from("plan_day").insert(dayRows).select("id,week_no,day_no");
  if (dayErr || !days) throw new Error(`plan_day seed: ${dayErr?.message}`);

  const items: Record<string, unknown>[] = [];
  for (const d of days) {
    const key = ({ 2: A, 4: B, 6: C } as Record<number, Record<number, Item[]>>)[d.day_no as number];
    if (!key) continue;
    for (const [round, list] of Object.entries(key)) {
      list.forEach(([name, sets, repMin, repMax, holdMin, holdMax, perSide, load], i) => {
        items.push({
          user_id: userId, plan_day_id: d.id, exercise_id: exId.get(name)!,
          round_no: Number(round), ord: i + 1,
          sets: d.week_no === 4 ? Math.min(sets, 2) : sets,
          rep_min: repMin, rep_max: repMax, hold_min_s: holdMin, hold_max_s: holdMax,
          per_side: perSide, load_text: load,
        });
      });
    }
  }
  const { error: itemErr } = await supabase.from("plan_item").insert(items);
  if (itemErr) throw new Error(`plan_item seed: ${itemErr.message}`);
}
