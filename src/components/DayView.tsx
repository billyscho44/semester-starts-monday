"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PlanDay, PlanItem, SessionRow } from "@/lib/plan";

export type CheckRow = {
  kind: "step" | "set";
  ref: string;
  set_no: number;
  done: boolean;
  reps: number | null;
  load_lb: number | null;
};
export type ResultRow = { plan_item_id: string; rating: "easy" | "average" | "hard"; completed_all: boolean };
export type FeedbackRow = {
  overall: "easy" | "average" | "hard" | null;
  completion: "yes" | "most" | "partial" | null;
  energy_before: "low" | "ok" | "good" | null;
  pain_flag: boolean;
  pain_area: string | null;
  note: string | null;
};

type Local = { done: boolean; reps: string; load: string };

const key = (kind: string, ref: string, n: number) => `${kind}:${ref}:${n}`;

function defaultReps(i: PlanItem): number {
  return (i.hold_min_s != null ? i.hold_max_s ?? i.hold_min_s : i.rep_max ?? i.rep_min) ?? 0;
}
function defaultLoad(i: PlanItem): string {
  const m = i.load_text.match(/(\d+(?:\.\d+)?)\s*lb/);
  return m ? m[1] : "";
}
function planText(i: PlanItem): string {
  const side = i.per_side ? " per side" : "";
  if (i.hold_min_s != null) {
    const h = i.hold_max_s && i.hold_max_s !== i.hold_min_s ? `${i.hold_min_s} to ${i.hold_max_s}` : `${i.hold_min_s}`;
    return `${i.sets} × ${h} s${side}`;
  }
  const r = i.rep_max && i.rep_max !== i.rep_min ? `${i.rep_min} to ${i.rep_max}` : `${i.rep_min}`;
  return `${i.sets} × ${r}${side}`;
}

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned", done: "Done", partial: "Partly done", minimum: "Minimum day", skipped: "Skipped",
};

function Seg<T extends string>({
  value, options, onChange, label,
}: { value: T | null; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`min-h-11 flex-1 rounded-xl border px-2 text-sm ${
            value === v ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-ink"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export default function DayView(props: {
  userId: string;
  date: string;
  editable: boolean;
  day: PlanDay | null;
  session: SessionRow | null;
  checks: CheckRow[];
  results: ResultRow[];
  feedback: FeedbackRow | null;
}) {
  const { userId, date, editable, day } = props;
  const supabase = useRef(createClient()).current;
  const sessionId = useRef<string | null>(props.session?.id ?? null);

  const [local, setLocal] = useState<Record<string, Local>>(() => {
    const m: Record<string, Local> = {};
    for (const c of props.checks)
      m[key(c.kind, c.ref, c.set_no)] = { done: c.done, reps: c.reps?.toString() ?? "", load: c.load_lb?.toString() ?? "" };
    return m;
  });
  const [ratings, setRatings] = useState<Record<string, ResultRow["rating"]>>(() =>
    Object.fromEntries(props.results.map((r) => [r.plan_item_id, r.rating])),
  );
  const [status, setStatus] = useState(props.session?.status ?? "planned");
  const [zwift, setZwift] = useState(props.session?.zwift_workout ?? "");
  const [reason, setReason] = useState(props.session?.miss_reason ?? "");
  const [fb, setFb] = useState<FeedbackRow>(
    props.feedback ?? { overall: null, completion: null, energy_before: null, pain_flag: false, pain_area: "", note: "" },
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ensureSession(): Promise<string | null> {
    if (sessionId.current) return sessionId.current;
    const { data, error } = await supabase
      .from("session")
      .upsert({ user_id: userId, date, plan_day_id: day?.id ?? null }, { onConflict: "user_id,date" })
      .select("id")
      .single();
    if (error || !data) { setErr(error?.message ?? "Could not create session"); return null; }
    sessionId.current = data.id;
    return data.id;
  }

  async function saveCheck(kind: "step" | "set", ref: string, n: number, v: Local) {
    const sid = await ensureSession();
    if (!sid) return;
    const { error } = await supabase.from("check_log").upsert(
      {
        user_id: userId, session_id: sid, kind, ref, set_no: n, done: v.done,
        reps: v.reps === "" ? null : Number(v.reps),
        load_lb: v.load === "" ? null : Number(v.load),
        bw_factor: kind === "set" ? day?.plan_item.find((i) => i.id === ref)?.exercise?.bw_factor ?? null : null,
      },
      { onConflict: "session_id,kind,ref,set_no" },
    );
    setErr(error ? error.message : null);
  }

  function update(kind: "step" | "set", ref: string, n: number, patch: Partial<Local>, base?: Local) {
    const k = key(kind, ref, n);
    const next = { ...(local[k] ?? base ?? { done: false, reps: "", load: "" }), ...patch };
    setLocal((s) => ({ ...s, [k]: next }));
    if (patch.done !== undefined || next.done) void saveCheck(kind, ref, n, next);
  }

  function setDefaults(i: PlanItem): Local {
    return { done: false, reps: String(defaultReps(i)), load: defaultLoad(i) };
  }

  function allAsPlanned(i: PlanItem) {
    for (let n = 1; n <= i.sets; n++) update("set", i.id, n, { done: true }, setDefaults(i));
  }

  async function rate(i: PlanItem, rating: ResultRow["rating"]) {
    setRatings((r) => ({ ...r, [i.id]: rating }));
    const sid = await ensureSession();
    if (!sid) return;
    let doneSets = 0;
    for (let n = 1; n <= i.sets; n++) if (local[key("set", i.id, n)]?.done) doneSets++;
    const { error } = await supabase.from("exercise_result").upsert(
      { user_id: userId, session_id: sid, plan_item_id: i.id, rating, completed_all: doneSets >= i.sets },
      { onConflict: "session_id,plan_item_id" },
    );
    setErr(error ? error.message : null);
  }

  async function setSessionStatus(next: SessionRow["status"], extra: Record<string, unknown> = {}) {
    const sid = await ensureSession();
    if (!sid) return false;
    const { error } = await supabase
      .from("session")
      .update({ status: next, completed_at: next === "planned" ? null : new Date().toISOString(), ...extra })
      .eq("id", sid);
    if (error) { setErr(error.message); return false; }
    setStatus(next);
    setErr(null);
    return true;
  }

  async function saveFeedback() {
    const sid = await ensureSession();
    if (!sid) return;
    const { error } = await supabase.from("session_feedback").upsert(
      {
        user_id: userId, session_id: sid, overall: fb.overall, completion: fb.completion,
        energy_before: fb.energy_before, pain_flag: fb.pain_flag,
        pain_area: fb.pain_flag ? fb.pain_area || null : null, note: fb.note || null,
      },
      { onConflict: "session_id" },
    );
    if (error) { setErr(error.message); return; }
    const next = fb.completion === "yes" ? "done" : "partial";
    if (await setSessionStatus(next, { zwift_workout: zwift || null, miss_reason: null })) setMsg("Saved.");
  }

  async function minimumDay() {
    if (await setSessionStatus("minimum", { miss_reason: null })) setMsg("Minimum day recorded.");
  }

  async function skip() {
    if (!reason.trim()) { setErr("Enter a reason first."); return; }
    if (await setSessionStatus("skipped", { miss_reason: reason.trim() })) setMsg("Skip recorded.");
  }

  if (!day) {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-card p-5">
        <p className="text-sm text-muted">No planned session for this date.</p>
      </section>
    );
  }

  const stepDone = (idx: number) => local[key("step", String(idx), 0)]?.done ?? false;
  const items = (n: number) => day.plan_item.filter((p) => p.round_no === n).sort((a, b) => a.ord - b.ord);

  return (
    <>
      <section className="mt-6 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Week {day.week_no} · Day {day.day_no} · about {day.minutes_est} min
            </p>
            <h2 className="mt-1 text-xl font-semibold">{day.title}</h2>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
              status === "planned" ? "border-line text-muted" : "border-accent text-accent"
            }`}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        <ol className="mt-4 space-y-4">
          {day.steps.map((s, idx) => {
            if (s.type === "round") {
              return (
                <li key={idx}>
                  <p className="text-sm font-semibold">Round {s.n}</p>
                  <ul className="mt-2 space-y-4">
                    {items(s.n).map((it) => (
                      <li key={it.id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm">
                            <span className="font-medium">{it.exercise?.name}</span>
                            <span className="text-muted"> · {planText(it)}{it.load_text ? ` · ${it.load_text}` : ""}</span>
                          </p>
                        </div>
                        <ul className="mt-1.5 space-y-1.5">
                          {Array.from({ length: it.sets }, (_, k) => k + 1).map((n) => {
                            const v = local[key("set", it.id, n)] ?? setDefaults(it);
                            const unit = it.hold_min_s != null ? "s" : "reps";
                            return (
                              <li key={n} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!editable}
                                  aria-pressed={v.done}
                                  aria-label={`Set ${n} done`}
                                  onClick={() => update("set", it.id, n, { done: !v.done }, setDefaults(it))}
                                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl border text-sm ${
                                    v.done ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-muted"
                                  }`}
                                >
                                  {v.done ? "✓" : n}
                                </button>
                                <input
                                  inputMode="numeric" aria-label={`Set ${n} ${unit}`} disabled={!editable}
                                  value={v.reps}
                                  onChange={(e) => update("set", it.id, n, { reps: e.target.value.replace(/\D/g, "") }, setDefaults(it))}
                                  className="h-11 w-16 rounded-xl border border-line bg-bg px-2 text-center"
                                />
                                <span className="text-xs text-muted">{unit}</span>
                                <input
                                  inputMode="decimal" aria-label={`Set ${n} load in lb`} placeholder="lb" disabled={!editable}
                                  value={v.load}
                                  onChange={(e) => update("set", it.id, n, { load: e.target.value.replace(/[^\d.]/g, "") }, setDefaults(it))}
                                  className="h-11 w-16 rounded-xl border border-line bg-bg px-2 text-center"
                                />
                                <span className="text-xs text-muted">lb</span>
                              </li>
                            );
                          })}
                        </ul>
                        {editable && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => allAsPlanned(it)} className="min-h-11 text-sm text-accent underline underline-offset-4">
                              All sets as planned
                            </button>
                            <div className="w-full">
                              <Seg
                                label={`${it.exercise?.name} effort`}
                                value={ratings[it.id] ?? null}
                                onChange={(v) => rate(it, v)}
                                options={[["easy", "Easy"], ["average", "Average"], ["hard", "Hard"]]}
                              />
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            }
            const done = stepDone(idx);
            return (
              <li key={idx} className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={!editable}
                  aria-pressed={done}
                  aria-label={`${s.label} done`}
                  onClick={() => update("step", String(idx), 0, { done: !done }, { done: false, reps: "", load: "" })}
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
                    done ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-muted"
                  }`}
                >
                  {done ? "✓" : ""}
                </button>
                <div className="pt-1.5">
                  <p className="text-sm font-semibold">
                    {s.label} <span className="font-normal text-muted">· {s.min} min</span>
                  </p>
                  {s.note && <p className="mt-0.5 text-sm leading-snug text-muted">{s.note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {editable ? (
        <section className="mt-4 space-y-4 rounded-2xl border border-line bg-card p-5">
          <h2 className="text-base font-semibold">How did it go</h2>
          {day.session_kind !== "strength" && (
            <label className="block text-sm">
              <span className="text-muted">Zwift workout (name)</span>
              <input
                value={zwift} onChange={(e) => setZwift(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-bg px-3"
              />
            </label>
          )}
          <div className="space-y-1.5">
            <p className="text-sm text-muted">Overall</p>
            <Seg label="Overall" value={fb.overall} onChange={(v) => setFb({ ...fb, overall: v })}
              options={[["easy", "Easy"], ["average", "Average"], ["hard", "Hard"]]} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted">Finished the whole session</p>
            <Seg label="Completion" value={fb.completion} onChange={(v) => setFb({ ...fb, completion: v })}
              options={[["yes", "Yes"], ["most", "Most"], ["partial", "Partial"]]} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted">Energy before</p>
            <Seg label="Energy before" value={fb.energy_before} onChange={(v) => setFb({ ...fb, energy_before: v })}
              options={[["low", "Low"], ["ok", "OK"], ["good", "Good"]]} />
          </div>
          <div className="space-y-1.5">
            <button
              type="button" aria-pressed={fb.pain_flag}
              onClick={() => setFb({ ...fb, pain_flag: !fb.pain_flag })}
              className={`min-h-11 w-full rounded-xl border px-3 text-sm ${
                fb.pain_flag ? "border-danger text-danger" : "border-line text-ink"
              }`}
            >
              {fb.pain_flag ? "Something hurt: yes" : "Something hurts?"}
            </button>
            {fb.pain_flag && (
              <input
                placeholder="Where (for example, left knee)" value={fb.pain_area ?? ""}
                onChange={(e) => setFb({ ...fb, pain_area: e.target.value })}
                className="h-11 w-full rounded-xl border border-line bg-bg px-3"
              />
            )}
          </div>
          <textarea
            placeholder="Note (optional)" rows={2} value={fb.note ?? ""}
            onChange={(e) => setFb({ ...fb, note: e.target.value })}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2"
          />
          <button
            type="button" onClick={saveFeedback} disabled={!fb.completion}
            className="min-h-12 w-full rounded-xl bg-accent px-4 font-medium text-accent-ink disabled:opacity-40"
          >
            Save session
          </button>
          {!fb.completion && <p className="text-xs text-muted">Pick how much you finished to save.</p>}

          <div className="border-t border-line pt-4">
            <button type="button" onClick={minimumDay} className="min-h-11 w-full rounded-xl border border-line text-sm">
              Minimum day: I did 10 minutes of something
            </button>
            <div className="mt-3 flex gap-2">
              <input
                placeholder="Reason, if skipping" value={reason} onChange={(e) => setReason(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3"
              />
              <button type="button" onClick={skip} className="min-h-11 rounded-xl border border-line px-4 text-sm">
                Skip
              </button>
            </div>
          </div>
          {msg && <p className="text-sm text-accent" role="status">{msg}</p>}
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        </section>
      ) : (
        <p className="mt-4 text-sm text-muted">Future day: view only. Logging opens on the day.</p>
      )}
    </>
  );
}
