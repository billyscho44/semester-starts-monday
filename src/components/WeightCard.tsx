"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function WeightCard(props: { userId: string; date: string; initial: number | null; last: { date: string; lb: number } | null }) {
  const supabase = useRef(createClient()).current;
  const [val, setVal] = useState(props.initial?.toString() ?? "");
  const [saved, setSaved] = useState(props.initial != null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const lb = Number(val);
    if (!(lb >= 50 && lb <= 500)) { setErr("Enter a weight between 50 and 500 lb."); return; }
    const { error } = await supabase
      .from("weight_log")
      .upsert({ user_id: props.userId, date: props.date, weight_lb: lb }, { onConflict: "user_id,date" });
    setErr(error ? error.message : null);
    setSaved(!error);
  }

  return (
    <section className="mt-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-base font-semibold">Weight</h2>
      <div className="mt-3 flex items-center gap-2">
        <input
          inputMode="decimal" aria-label="Weight in pounds" placeholder="lb" value={val}
          onChange={(e) => { setVal(e.target.value.replace(/[^\d.]/g, "")); setSaved(false); }}
          className="h-11 w-28 rounded-xl border border-line bg-bg px-3"
        />
        <span className="text-sm text-muted">lb</span>
        <button type="button" onClick={save} className="ml-auto min-h-11 rounded-xl bg-accent px-5 font-medium text-accent-ink">
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      {props.last && !saved && (
        <p className="mt-2 text-xs text-muted">Last entry: {props.last.lb} lb on {props.last.date}</p>
      )}
      {err && <p className="mt-2 text-sm text-danger" role="alert">{err}</p>}
    </section>
  );
}
