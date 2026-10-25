"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type CreditOption = { id: string; title: string };

/** Lets Billy decide which plan slot a day's logged work counts toward. Automatic is the default. */
export default function CreditControl(props: {
  userId: string;
  date: string;
  kind: "cardio" | "strength";
  options: CreditOption[];
  override: string | null | undefined; // undefined = automatic, null = counts toward nothing, id = chosen slot
  autoText: string;
}) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const [value, setValue] = useState<string>(props.override === undefined ? "auto" : props.override === null ? "none" : props.override);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(v: string) {
    setValue(v); setErr(null); setBusy(true);
    const q = supabase.from("credit_override");
    const { error } =
      v === "auto"
        ? await q.delete().eq("user_id", props.userId).eq("date", props.date).eq("kind", props.kind)
        : await q.upsert(
            { user_id: props.userId, date: props.date, kind: props.kind, plan_day_id: v === "none" ? null : v },
            { onConflict: "user_id,date,kind" },
          );
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.refresh();
  }

  return (
    <label className="block text-sm">
      <span className="text-muted">{props.kind === "strength" ? "Strength" : "Cardio"} work today counts toward</span>
      <select value={value} disabled={busy} onChange={(e) => change(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-bg px-3">
        <option value="auto">Automatic: {props.autoText}</option>
        {props.options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        <option value="none">Nothing in the plan</option>
      </select>
      {err && <span className="mt-1 block text-sm text-danger" role="alert">{err}</span>}
    </label>
  );
}
