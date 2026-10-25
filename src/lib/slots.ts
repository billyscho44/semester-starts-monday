import type { SupabaseClient } from "@supabase/supabase-js";
import { dayIndex } from "./dates";
import { MIN_ACTIVE_MIN } from "./activity";

/**
 * Weekly slots. Each plan week has seven slots (3 cardio, 3 strength, 1 recovery). A slot is filled by
 * the work Billy actually did that week, on whatever day, not by the calendar day the plan gave it.
 * Everything here is computed from the log, never stored, so a changed entry or override takes effect at once.
 */

export type SlotKind = "cardio" | "strength" | "recovery";
export type Level = "full" | "partial";

export type Slot = {
  id: string;
  week_no: number;
  day_no: number;
  kind: SlotKind;
  title: string;
  plannedSets: number;
  plannedCardioMin: number;
};

export type SessionIn = { date: string; plan_day_id: string | null; status: string };
export type DayWork = { strengthSets: number; cardioMin: number };
export type OverrideIn = { date: string; kind: "cardio" | "strength"; plan_day_id: string | null };

export type Fill = { slotId: string; kind: SlotKind; date: string; source: "session" | "logged"; level: Level; forced: boolean };

export const FULL_SHARE = 0.8;    // at least 80% of the slot's planned work counts as a full credit
export const PARTIAL_SHARE = 0.4; // at least 40% of planned sets counts as a partial credit for strength

const EXCLUDED_STEPS = new Set(["Flexibility", "Core and balance"]);

export function toSlot(d: {
  id: string; week_no: number; day_no: number; session_kind: SlotKind; title: string;
  steps: { type: string; label?: string; min?: number }[]; plan_item: { sets: number }[];
}): Slot {
  return {
    id: d.id, week_no: d.week_no, day_no: d.day_no, kind: d.session_kind, title: d.title,
    plannedSets: d.plan_item.reduce((t, i) => t + i.sets, 0),
    plannedCardioMin: d.steps
      .filter((s) => s.type === "step" && !EXCLUDED_STEPS.has(s.label ?? ""))
      .reduce((t, s) => t + (s.min ?? 0), 0),
  };
}

export function computeSlots(input: {
  start: string;
  slots: Slot[];
  sessions: SessionIn[];
  work: Map<string, DayWork>;
  overrides: OverrideIn[];
}): { fills: Map<string, Fill>; byDate: Map<string, Fill[]> } {
  const { start, slots, sessions, work, overrides } = input;
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const fills = new Map<string, Fill>();
  const weekOf = (date: string) => Math.floor(dayIndex(start, date) / 7) + 1;
  const defaultSlot = (date: string): Slot | undefined => {
    const idx = dayIndex(start, date);
    return slots.find((s) => s.week_no === Math.floor(idx / 7) + 1 && s.day_no === (idx % 7) + 1);
  };

  // 1. Planned sessions fill their own slot.
  for (const s of sessions) {
    if (!s.plan_day_id || !["done", "partial", "minimum"].includes(s.status)) continue;
    const slot = slotById.get(s.plan_day_id);
    if (!slot || fills.has(slot.id)) continue;
    fills.set(slot.id, {
      slotId: slot.id, kind: slot.kind, date: s.date, source: "session",
      level: s.status === "done" ? "full" : "partial", forced: false,
    });
  }
  const sessionFillKinds = (date: string) =>
    new Set([...fills.values()].filter((f) => f.date === date && f.source === "session").map((f) => f.kind));

  // 2. Work logged outside the plan fills open slots of the matching kind, oldest day first.
  const dates = [...work.keys(), ...overrides.map((o) => o.date)]
    .filter((d, i, a) => a.indexOf(d) === i && dayIndex(start, d) >= 0 && dayIndex(start, d) < 28)
    .sort();

  const open = (w: number, kind: SlotKind) =>
    slots.filter((s) => s.week_no === w && s.kind === kind && !fills.has(s.id)).sort((a, b) => a.day_no - b.day_no);

  for (const date of dates) {
    const w = weekOf(date);
    const info = work.get(date) ?? { strengthSets: 0, cardioMin: 0 };
    const own = defaultSlot(date);
    const taken = sessionFillKinds(date);

    for (const kind of ["strength", "cardio"] as const) {
      const ov = overrides.find((o) => o.date === date && o.kind === kind);
      if (ov && ov.plan_day_id == null) continue; // Billy said: counts toward nothing
      if (!ov && taken.has(kind)) continue;       // the planned session already covered this kind today

      const amount = kind === "strength" ? info.strengthSets : info.cardioMin;
      if (!ov && amount <= 0) continue;

      let target: Slot | undefined;
      let forced = false;
      if (ov?.plan_day_id) {
        target = slotById.get(ov.plan_day_id);
        forced = true;
        const existing = target ? fills.get(target.id) : undefined;
        if (existing && existing.source === "session") continue; // never take a slot a planned session filled
      } else if (own && own.kind === kind && !fills.has(own.id)) {
        target = own;
      } else {
        target = open(w, kind)[0];
      }
      if (!target) {
        // No cardio slot left this week: extra cardio fills the recovery slot.
        if (kind === "cardio" && amount >= MIN_ACTIVE_MIN) target = open(w, "recovery")[0];
        if (!target) continue;
        fills.set(target.id, { slotId: target.id, kind: target.kind, date, source: "logged", level: "full", forced: false });
        continue;
      }

      let level: Level | null;
      if (forced) level = "full";
      else if (kind === "strength") {
        level = amount >= FULL_SHARE * target.plannedSets ? "full" : amount >= PARTIAL_SHARE * target.plannedSets ? "partial" : null;
      } else {
        level = amount >= FULL_SHARE * target.plannedCardioMin ? "full" : amount >= MIN_ACTIVE_MIN ? "partial" : null;
      }
      if (!level) continue;
      fills.set(target.id, { slotId: target.id, kind: target.kind, date, source: "logged", level, forced });
    }
  }

  const byDate = new Map<string, Fill[]>();
  for (const f of fills.values()) byDate.set(f.date, [...(byDate.get(f.date) ?? []), f]);
  return { fills, byDate };
}

export type WeekSummary = { kind: SlotKind; total: number; filled: number; full: number };

export function weekSummary(slots: Slot[], fills: Map<string, Fill>, week: number): WeekSummary[] {
  return (["cardio", "strength", "recovery"] as const).map((kind) => {
    const list = slots.filter((s) => s.week_no === week && s.kind === kind);
    const got = list.map((s) => fills.get(s.id)).filter((f): f is Fill => !!f);
    return { kind, total: list.length, filled: got.length, full: got.filter((f) => f.level === "full").length };
  });
}

/** Loads everything the credit engine needs. One round of queries. */
export async function loadSlotInputs(supabase: SupabaseClient, start: string) {
  const [pd, ses, acts, str, ovr] = await Promise.all([
    supabase.from("plan_day").select("id,week_no,day_no,session_kind,title,steps,plan_item(sets)").order("week_no").order("day_no"),
    supabase.from("session").select("date,plan_day_id,status"),
    supabase.from("activity_log").select("date,kind,minutes,activity_set(id)"),
    supabase.from("strava_activity").select("local_date,moving_s,session_id"),
    supabase.from("credit_override").select("date,kind,plan_day_id"),
  ]);
  const slots = ((pd.data ?? []) as unknown as Parameters<typeof toSlot>[0][]).map(toSlot);
  const work = new Map<string, DayWork>();
  const bump = (date: string, p: Partial<DayWork>) => {
    const cur = work.get(date) ?? { strengthSets: 0, cardioMin: 0 };
    work.set(date, { strengthSets: cur.strengthSets + (p.strengthSets ?? 0), cardioMin: cur.cardioMin + (p.cardioMin ?? 0) });
  };
  for (const a of (acts.data ?? []) as unknown as { date: string; kind: string; minutes: number | null; activity_set: { id: string }[] }[]) {
    if (a.kind === "strength") bump(a.date, { strengthSets: a.activity_set?.length ?? 0 });
    else bump(a.date, { cardioMin: a.minutes ?? 0 });
  }
  // Strava activities already matched to a planned session are counted through that session.
  for (const r of (str.data ?? []) as { local_date: string; moving_s: number | null; session_id: string | null }[]) {
    if (!r.session_id) bump(r.local_date, { cardioMin: Math.round((r.moving_s ?? 0) / 60) });
  }
  return {
    start, slots, work,
    sessions: (ses.data ?? []) as SessionIn[],
    overrides: (ovr.data ?? []) as OverrideIn[],
  };
}
