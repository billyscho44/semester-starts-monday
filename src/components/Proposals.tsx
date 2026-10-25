"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProposalRow = {
  id: string;
  kind: string;
  summary: string;
  reason: string;
  status: "pending" | "accepted" | "edited" | "dismissed";
  new_target_reps: number | null;
  new_target_load_lb: number | null;
};

export default function Proposals({ rows, title }: { rows: ProposalRow[]; title: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [reps, setReps] = useState("");
  const [load, setLoad] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(id: string, action: "accept" | "edit" | "dismiss") {
    setBusy(true);
    const r = await fetch("/api/proposals", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action, reps: reps ? Number(reps) : null, load: load ? Number(load) : null }),
    });
    setBusy(false);
    if (!r.ok) { setErr("Could not save that. Try again."); return; }
    setErr(null);
    setEditing(null);
    router.refresh();
  }

  if (rows.length === 0) return null;
  const pending = rows.filter((r) => r.status === "pending");
  const rest = rows.filter((r) => r.status !== "pending");

  return (
    <section className="mt-6 rounded-2xl border border-line bg-card p-5" aria-label={title}>
      <h2 className="text-base font-semibold">{title}</h2>
      {pending.length > 0 && (
        <ul className="mt-3 space-y-4">
          {pending.map((p) => (
            <li key={p.id}>
              <p className="text-sm font-medium">{p.summary}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted">{p.reason}</p>
              {editing === p.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    inputMode="numeric" aria-label="Reps" placeholder={p.new_target_reps?.toString() ?? "reps"} value={reps}
                    onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))}
                    className="h-11 w-20 rounded-xl border border-line bg-bg px-2 text-center"
                  />
                  <input
                    inputMode="decimal" aria-label="Load in lb" placeholder={p.new_target_load_lb?.toString() ?? "lb"} value={load}
                    onChange={(e) => setLoad(e.target.value.replace(/[^\d.]/g, ""))}
                    className="h-11 w-20 rounded-xl border border-line bg-bg px-2 text-center"
                  />
                  <button disabled={busy} onClick={() => send(p.id, "edit")} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink">Save</button>
                  <button disabled={busy} onClick={() => setEditing(null)} className="min-h-11 px-2 text-sm text-muted">Cancel</button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button disabled={busy} onClick={() => send(p.id, "accept")} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink">Accept</button>
                  <button disabled={busy} onClick={() => { setEditing(p.id); setReps(""); setLoad(""); }} className="min-h-11 rounded-xl border border-line px-4 text-sm">Edit</button>
                  <button disabled={busy} onClick={() => send(p.id, "dismiss")} className="min-h-11 px-3 text-sm text-muted">Dismiss</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {rest.length > 0 && (
        <ul className={`${pending.length ? "mt-4 border-t border-line pt-3" : "mt-3"} space-y-2`}>
          {rest.map((p) => (
            <li key={p.id} className="text-sm leading-snug">
              <span className={p.kind === "repeat" ? "text-muted" : ""}>{p.summary}</span>
              <span className="text-xs text-muted">
                {" "}
                · {p.kind === "repeat" ? p.reason : p.status === "dismissed" ? "dismissed" : p.status === "edited" ? "accepted, edited" : "accepted"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="mt-2 text-sm text-danger" role="alert">{err}</p>}
    </section>
  );
}
