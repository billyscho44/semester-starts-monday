"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KIND_LABEL, type ActivityKind, type LoggedActivity } from "@/lib/activity";

export type ExerciseOption = { id: string; name: string; unit: "reps" | "seconds" | "minutes"; bw_factor: number | null };

type SetRow = { reps: string; load: string };

const KINDS: ActivityKind[] = ["walk", "run", "ride", "strength", "other"];
const QUICK = ["Push-up", "Sit-up", "Plank", "Chair squat"];

function summary(a: LoggedActivity): string {
  if (a.kind === "strength") {
    const unit = a.exercise?.unit === "seconds" ? " s" : "";
    const sets = a.sets.map((s) => `${s.reps}${unit}${s.load_lb ? ` @ ${s.load_lb} lb` : ""}`).join(", ");
    return `${a.sets.length} set${a.sets.length === 1 ? "" : "s"}: ${sets}`;
  }
  return [a.minutes != null && `${a.minutes} min`, a.distance_mi != null && `${a.distance_mi} mi`].filter(Boolean).join(" · ");
}

export default function ActivityLogger(props: {
  userId: string;
  date: string;
  editable: boolean;
  exercises: ExerciseOption[];
  entries: LoggedActivity[];
}) {
  const { userId, date, editable, exercises, entries } = props;
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ActivityKind>("walk");
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState("");
  const [miles, setMiles] = useState("");
  const [note, setNote] = useState("");
  const [exId, setExId] = useState<string>(() => exercises.find((e) => e.name === "Push-up")?.id ?? exercises[0]?.id ?? "");
  const [sets, setSets] = useState<SetRow[]>([{ reps: "", load: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const ex = exercises.find((e) => e.id === exId) ?? null;
  const quick = QUICK.map((n) => exercises.find((e) => e.name === n)).filter((e): e is ExerciseOption => !!e);

  function reset() {
    setLabel(""); setMinutes(""); setMiles(""); setNote(""); setSets([{ reps: "", load: "" }]);
  }

  function addSet() {
    setSets((s) => [...s, { ...(s[s.length - 1] ?? { reps: "", load: "" }) }]);
  }
  function patchSet(i: number, p: Partial<SetRow>) {
    setSets((s) => s.map((r, k) => (k === i ? { ...r, ...p } : r)));
  }
  function dropSet(i: number) {
    setSets((s) => (s.length > 1 ? s.filter((_, k) => k !== i) : s));
  }

  async function save() {
    setErr(null); setMsg(null);
    const isStrength = kind === "strength";
    const mins = minutes === "" ? null : Number(minutes);
    if (!isStrength) {
      if (!mins || mins < 1) { setErr("Enter the minutes."); return; }
      if (kind === "other" && !label.trim()) { setErr("Enter what you did."); return; }
    }
    const rows = sets
      .map((s, i) => ({ set_no: i + 1, reps: Number(s.reps), load_lb: s.load === "" ? null : Number(s.load) }))
      .filter((s) => s.reps >= 1);
    if (isStrength) {
      if (!ex) { setErr("Pick an exercise."); return; }
      if (rows.length === 0) { setErr("Enter the reps for at least one set."); return; }
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("activity_log")
      .insert({
        user_id: userId, date, kind,
        label: kind === "other" ? label.trim() : null,
        exercise_id: isStrength ? ex!.id : null,
        minutes: isStrength ? null : mins,
        distance_mi: !isStrength && miles !== "" ? Number(miles) : null,
        note: note.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) { setBusy(false); setErr(error?.message ?? "Could not save."); return; }
    if (isStrength) {
      const { error: sErr } = await supabase.from("activity_set").insert(
        rows.map((r, i) => ({
          user_id: userId, activity_id: data.id, set_no: i + 1, reps: r.reps, load_lb: r.load_lb, bw_factor: ex!.bw_factor,
        })),
      );
      if (sErr) {
        await supabase.from("activity_log").delete().eq("id", data.id);
        setBusy(false); setErr(sErr.message); return;
      }
    }
    setBusy(false);
    setMsg("Logged.");
    reset();
    setOpen(false);
    router.refresh();
  }

  async function remove(id: string) {
    setErr(null); setMsg(null);
    const { error } = await supabase.from("activity_log").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    router.refresh();
  }

  const field = "h-11 rounded-xl border border-line bg-bg px-3";

  return (
    <section className="mt-4 rounded-2xl border border-line bg-card p-5" aria-label="Other activity">
      <h2 className="text-base font-semibold">Other activity</h2>
      <p className="mt-0.5 text-xs text-muted">Anything outside the plan counts toward your streak: a walk, a run, push-ups, sit-ups.</p>

      {entries.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {entries.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {a.kind === "strength" ? a.exercise?.name ?? "Strength" : a.kind === "other" ? a.label : KIND_LABEL[a.kind]}
                </p>
                <p className="text-sm text-muted">{summary(a)}</p>
                {a.note && <p className="mt-0.5 text-xs text-muted">{a.note}</p>}
              </div>
              {editable && (
                <button
                  type="button" onClick={() => remove(a.id)} aria-label={`Delete ${a.kind === "strength" ? a.exercise?.name : KIND_LABEL[a.kind]} entry`}
                  className="min-h-11 shrink-0 px-2 text-sm text-muted underline underline-offset-4"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && !open && (
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }}
          className="mt-3 min-h-11 w-full rounded-xl border border-line text-sm">
          Log an activity
        </button>
      )}

      {editable && open && (
        <div className="mt-3 space-y-3">
          <div role="group" aria-label="Activity type" className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                className={`min-h-11 rounded-xl border px-3 text-sm ${kind === k ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-ink"}`}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          {kind === "strength" ? (
            <>
              <div role="group" aria-label="Exercise" className="flex flex-wrap gap-1.5">
                {quick.map((q) => (
                  <button key={q.id} type="button" aria-pressed={exId === q.id} onClick={() => setExId(q.id)}
                    className={`min-h-11 rounded-xl border px-3 text-sm ${exId === q.id ? "border-accent text-accent" : "border-line text-ink"}`}>
                    {q.name}
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                <span className="text-muted">Exercise</span>
                <select value={exId} onChange={(e) => setExId(e.target.value)} className={`${field} mt-1 w-full`}>
                  {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <ul className="space-y-1.5">
                {sets.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-bg text-sm text-muted">{i + 1}</span>
                    <input inputMode="numeric" aria-label={`Set ${i + 1} ${ex?.unit === "seconds" ? "seconds" : "reps"}`}
                      value={s.reps} onChange={(e) => patchSet(i, { reps: e.target.value.replace(/\D/g, "") })}
                      className={`${field} w-16 text-center`} />
                    <span className="text-xs text-muted">{ex?.unit === "seconds" ? "s" : "reps"}</span>
                    <input inputMode="decimal" aria-label={`Set ${i + 1} added weight in lb`} placeholder="lb"
                      value={s.load} onChange={(e) => patchSet(i, { load: e.target.value.replace(/[^\d.]/g, "") })}
                      className={`${field} w-16 text-center`} />
                    <span className="text-xs text-muted">lb</span>
                    {sets.length > 1 && (
                      <button type="button" onClick={() => dropSet(i)} aria-label={`Remove set ${i + 1}`} className="min-h-11 px-2 text-sm text-muted">✕</button>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={addSet} className="min-h-11 text-sm text-accent underline underline-offset-4">
                Add set (copies the last one)
              </button>
              {ex && ex.bw_factor != null && (
                <p className="text-xs text-muted">Counts about {Math.round(ex.bw_factor * 100)}% of your body weight per rep. Weight box is added weight only.</p>
              )}
            </>
          ) : (
            <>
              {kind === "other" && (
                <input placeholder="What did you do" value={label} onChange={(e) => setLabel(e.target.value)} className={`${field} w-full`} />
              )}
              <div className="flex items-center gap-2">
                <input inputMode="numeric" aria-label="Minutes" placeholder="Minutes" value={minutes}
                  onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} className={`${field} w-24 text-center`} />
                <span className="text-xs text-muted">min</span>
                <input inputMode="decimal" aria-label="Miles" placeholder="Miles" value={miles}
                  onChange={(e) => setMiles(e.target.value.replace(/[^\d.]/g, ""))} className={`${field} w-24 text-center`} />
                <span className="text-xs text-muted">mi (optional)</span>
              </div>
              <p className="text-xs text-muted">Walks and runs recorded by your Watch arrive from Strava by themselves. Log by hand only what Strava will not have.</p>
            </>
          )}

          <textarea placeholder="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2" />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy}
              className="min-h-12 flex-1 rounded-xl bg-accent px-4 font-medium text-accent-ink disabled:opacity-40">
              Save activity
            </button>
            <button type="button" onClick={() => { setOpen(false); setErr(null); }} className="min-h-12 rounded-xl border border-line px-4 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-accent" role="status">{msg}</p>}
      {err && <p className="mt-2 text-sm text-danger" role="alert">{err}</p>}
    </section>
  );
}
