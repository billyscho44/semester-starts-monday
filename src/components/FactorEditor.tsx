"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { id: string; name: string; bw_factor: number | null; bw_basis: string | null };

export default function FactorEditor({ rows }: { rows: Row[] }) {
  const supabase = useRef(createClient()).current;
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.id, r.bw_factor == null ? "" : String(r.bw_factor)])),
  );
  const [basis, setBasis] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.id, r.bw_basis ?? ""])),
  );
  const [err, setErr] = useState<string | null>(null);

  async function save(id: string) {
    const raw = vals[id].trim();
    const n = raw === "" ? null : Number(raw);
    if (n != null && !(n >= 0 && n <= 1.5)) { setErr("Use a number from 0 to 1.5, or leave blank."); return; }
    const b = n == null ? null : "edited";
    const { error } = await supabase.from("exercise").update({ bw_factor: n, bw_basis: b }).eq("id", id);
    setErr(error ? error.message : null);
    if (!error) setBasis((s) => ({ ...s, [id]: b ?? "" }));
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2">
            <label htmlFor={`f-${r.id}`} className="min-w-0 flex-1 text-sm leading-snug">
              {r.name}
              {basis[r.id] && <span className="block text-xs text-muted">{basis[r.id]}</span>}
            </label>
            <input
              id={`f-${r.id}`} inputMode="decimal" placeholder="none" value={vals[r.id]}
              onChange={(e) => setVals((s) => ({ ...s, [r.id]: e.target.value.replace(/[^\d.]/g, "") }))}
              onBlur={() => save(r.id)}
              className="h-11 w-20 rounded-xl border border-line bg-bg px-2 text-center"
            />
          </li>
        ))}
      </ul>
      {err && <p className="mt-2 text-sm text-danger" role="alert">{err}</p>}
    </div>
  );
}
