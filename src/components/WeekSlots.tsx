import { shortLabel } from "@/lib/dates";
import type { SlotKind, WeekSummary } from "@/lib/slots";
import CreditControl, { type CreditOption } from "./CreditControl";

export type SlotRow = {
  id: string;
  kind: SlotKind;
  title: string;
  date: string; // the calendar day the plan gave this slot
  fill: { date: string; level: "full" | "partial"; source: "session" | "logged"; forced: boolean } | null;
};

export type CreditInfo = {
  kind: "cardio" | "strength";
  options: CreditOption[];
  override: string | null | undefined;
  autoText: string;
};

const KIND: Record<SlotKind, string> = { cardio: "Cardio", strength: "Strength", recovery: "Recovery" };

/** This week's plan as seven slots, with what filled each one and what is still open. */
export default function WeekSlots(props: {
  userId: string;
  date: string;
  week: number;
  summary: WeekSummary[];
  rows: SlotRow[];
  credits: CreditInfo[];
  editable: boolean;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-line bg-card p-5" aria-label="This week's plan">
      <h2 className="text-base font-semibold">Week {props.week} of the plan</h2>
      <p className="mt-0.5 text-sm text-muted">
        {props.summary.map((s) => `${KIND[s.kind]} ${s.filled} of ${s.total}`).join(" · ")}
      </p>
      <ul className="mt-3 divide-y divide-line">
        {props.rows.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-3 py-2">
            <span className="min-w-0 truncate text-sm">{r.title.replace(" (deload)", "")}</span>
            {r.fill ? (
              <span className="shrink-0 text-xs text-accent">
                {r.fill.level === "full" ? "Done" : "Partly"} · {shortLabel(r.fill.date)}
                {r.fill.source === "logged" ? " (other activity)" : ""}
              </span>
            ) : (
              <span className="shrink-0 text-xs text-muted">Open</span>
            )}
          </li>
        ))}
      </ul>
      {props.editable && props.credits.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {props.credits.map((c) => (
            <CreditControl key={c.kind} userId={props.userId} date={props.date} kind={c.kind}
              options={c.options} override={c.override} autoText={c.autoText} />
          ))}
        </div>
      )}
    </section>
  );
}
