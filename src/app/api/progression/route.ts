import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { propose, type Ctx, type Rating } from "@/lib/progression";

export const dynamic = "force-dynamic";

/** Reads a saved session and writes one proposal per exercise rated in it. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
  const sessionId = body?.sessionId;
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const { data: session } = await supabase
    .from("session").select("id,date,plan_day_id").eq("id", sessionId).maybeSingle();
  if (!session?.plan_day_id) return NextResponse.json({ created: 0 });

  const [items, sets, results, fb, allResults, sessions] = await Promise.all([
    supabase.from("plan_item")
      .select("id,exercise_id,sets,rep_min,rep_max,hold_min_s,per_side,load_text,exercise:exercise_id(name,bw_factor)")
      .eq("plan_day_id", session.plan_day_id),
    supabase.from("check_log").select("ref,reps,load_lb").eq("session_id", sessionId).eq("kind", "set").eq("done", true),
    supabase.from("exercise_result").select("plan_item_id,rating").eq("session_id", sessionId),
    supabase.from("session_feedback").select("pain_flag").eq("session_id", sessionId).maybeSingle(),
    supabase.from("exercise_result").select("session_id,rating,completed_all,plan_item:plan_item_id(exercise_id)"),
    supabase.from("session").select("id,date"),
  ]);

  const dateOf = new Map((sessions.data ?? []).map((s) => [s.id as string, s.date as string]));
  const ratingOf = new Map((results.data ?? []).map((r) => [r.plan_item_id as string, r.rating as Rating]));
  const pain = !!fb.data?.pain_flag;

  const rows: Record<string, unknown>[] = [];
  for (const it of (items.data ?? []) as unknown as {
    id: string; exercise_id: string; sets: number; rep_min: number | null; rep_max: number | null;
    hold_min_s: number | null; per_side: boolean; load_text: string;
    exercise: { name: string; bw_factor: number | null } | null;
  }[]) {
    const rating = ratingOf.get(it.id);
    if (!rating) continue;
    const done = (sets.data ?? [])
      .filter((s) => s.ref === it.id)
      .map((s) => ({ reps: Number(s.reps ?? 0), load: s.load_lb == null ? null : Number(s.load_lb) }));
    const prev = ((allResults.data ?? []) as unknown as {
      session_id: string; rating: Rating; completed_all: boolean; plan_item: { exercise_id: string } | null;
    }[])
      .filter((r) => r.plan_item?.exercise_id === it.exercise_id && r.session_id !== sessionId
        && (dateOf.get(r.session_id) ?? "") < session.date)
      .sort((a, b) => (dateOf.get(b.session_id) ?? "").localeCompare(dateOf.get(a.session_id) ?? ""))
      .map((r) => ({ rating: r.rating, completedAll: r.completed_all }));

    const ctx: Ctx = {
      name: it.exercise?.name.replace(/,.*$/, "") ?? "Exercise",
      sets: it.sets, repMin: it.rep_min, repMax: it.rep_max, hold: it.hold_min_s != null,
      perSide: it.per_side, loadText: it.load_text, bwFactor: it.exercise?.bw_factor == null ? null : Number(it.exercise.bw_factor),
      done, rating, prev, pain,
    };
    const p = propose(ctx);
    rows.push({
      user_id: user.id, session_id: sessionId, exercise_id: it.exercise_id, kind: p.kind,
      summary: p.summary, reason: p.reason,
      new_target_reps: p.newReps ?? null, new_target_load_lb: p.newLoad ?? null, new_target_hold_s: p.newHold ?? null,
      new_load_text: p.newLoadText ?? null, new_bw_factor: p.newBwFactor ?? null,
      status: p.kind === "repeat" ? "accepted" : "pending",
    });
  }

  // Re-running replaces this session's pending proposals only.
  await supabase.from("proposal").delete().eq("session_id", sessionId).eq("status", "pending");
  await supabase.from("proposal").delete().eq("session_id", sessionId).eq("kind", "repeat");
  if (rows.length) {
    const { error } = await supabase.from("proposal").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ created: rows.length });
}
