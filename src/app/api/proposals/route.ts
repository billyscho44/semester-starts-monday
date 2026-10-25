import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dayIndex } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Body = { id?: string; action?: "accept" | "edit" | "dismiss"; reps?: number | null; load?: number | null };

/** Accept, edit or dismiss one proposal. Accepting updates this exercise in all later planned sessions. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b?.id || !b.action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const { data: p } = await supabase.from("proposal").select("*").eq("id", b.id).maybeSingle();
  if (!p) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (p.status !== "pending") return NextResponse.json({ ok: true, status: p.status });

  if (b.action === "dismiss") {
    await supabase.from("proposal").update({ status: "dismissed" }).eq("id", p.id);
    return NextResponse.json({ ok: true, status: "dismissed" });
  }

  const reps = b.action === "edit" ? b.reps ?? p.new_target_reps : p.new_target_reps;
  const load = b.action === "edit" ? b.load ?? p.new_target_load_lb : p.new_target_load_lb;

  const [{ data: settings }, { data: sess }] = await Promise.all([
    supabase.from("settings").select("plan_start_date").maybeSingle(),
    supabase.from("session").select("date").eq("id", p.session_id).maybeSingle(),
  ]);
  if (!settings || !sess) return NextResponse.json({ error: "Missing settings or session" }, { status: 500 });
  const sessIdx = dayIndex(settings.plan_start_date as string, sess.date as string);

  const { data: days } = await supabase.from("plan_day").select("id,week_no,day_no");
  const later = (days ?? [])
    .filter((d) => (d.week_no - 1) * 7 + (d.day_no - 1) > sessIdx)
    .map((d) => d.id as string);

  if (later.length) {
    const patch: Record<string, unknown> = {};
    if (reps != null) patch.target_reps = reps;
    if (load != null) patch.target_load_lb = load;
    if (p.new_target_hold_s != null) patch.target_hold_s = p.new_target_hold_s;
    if (p.new_load_text != null) {
      patch.load_text = load != null && load !== p.new_target_load_lb
        ? p.new_load_text.replace(/\d+(?:\.\d+)?/, String(load))
        : p.new_load_text;
    }
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("plan_item").update(patch)
        .eq("exercise_id", p.exercise_id).in("plan_day_id", later);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (p.new_bw_factor != null) {
    await supabase.from("exercise").update({ bw_factor: p.new_bw_factor, bw_basis: "edited" }).eq("id", p.exercise_id);
  }
  const status = b.action === "edit" ? "edited" : "accepted";
  await supabase.from("proposal").update({ status }).eq("id", p.id);
  return NextResponse.json({ ok: true, status });
}
