"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type SwapOption = { id: string; title: string };

/** Do a different session from this week's plan today. Only before anything is checked off. */
export default function SessionSwap(props: {
  userId: string;
  date: string;
  currentId: string;
  defaultId: string;
  options: SwapOption[];
  locked: boolean;
}) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const [value, setValue] = useState(props.currentId);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(id: string) {
    setValue(id); setErr(null); setBusy(true);
    const { error } = await supabase
      .from("session")
      .upsert({ user_id: props.userId, date: props.date, plan_day_id: id }, { onConflict: "user_id,date" });
    setBusy(false);
    if (error) { setErr(error.message); setValue(props.currentId); return; }
    router.refresh();
  }

  return (
    <label className="mt-6 block text-sm">
      <span className="text-muted">Today&apos;s session</span>
      <select value={value} disabled={busy || props.locked} onChange={(e) => change(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-card px-3">
        <option value={props.defaultId}>{props.options.find((o) => o.id === props.defaultId)?.title ?? "As planned"} (as planned)</option>
        {props.options.filter((o) => o.id !== props.defaultId).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
      </select>
      {props.locked && <span className="mt-1 block text-xs text-muted">Locked once something is checked off. Switch before you start.</span>}
      {err && <span className="mt-1 block text-sm text-danger" role="alert">{err}</span>}
    </label>
  );
}
