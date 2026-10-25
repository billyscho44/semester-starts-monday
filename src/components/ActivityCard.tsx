export type Activity = {
  id: number;
  name: string | null;
  sport_type: string | null;
  moving_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_watts: number | null;
  device_watts: boolean | null;
  zone_seconds: number[] | null;
  perceived_exertion: number | null;
  suffer_score?: string | null;
};

const ZONES = ["Z1", "Z2", "Z3", "Z4", "Z5"];
const OPACITY = [0.2, 0.4, 0.6, 0.8, 1];

export default function ActivityCard({ a }: { a: Activity }) {
  const mins = a.moving_s ? Math.round(a.moving_s / 60) : null;
  const z = a.zone_seconds;
  const total = z ? z.reduce((t, v) => t + v, 0) : 0;
  const miles = a.distance_m ? (a.distance_m / 1609.344).toFixed(1) : null;
  return (
    <section className="mt-6 rounded-2xl border border-line bg-card p-5" aria-label="Strava activity">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">From Strava</p>
      <h2 className="mt-1 text-base font-semibold">{a.name ?? a.sport_type}</h2>
      <p className="mt-1 text-sm text-muted">
        {[
          mins != null && `${mins} min`,
          miles && `${miles} mi`,
          a.avg_hr && `avg HR ${Math.round(a.avg_hr)}`,
          a.max_hr && `max ${Math.round(a.max_hr)}`,
          a.avg_watts && `${Math.round(a.avg_watts)} W${a.device_watts ? "" : " (estimated)"}`,
          a.suffer_score && `Relative Effort ${a.suffer_score}`,
          a.perceived_exertion != null && `effort ${a.perceived_exertion}/10`,
        ].filter(Boolean).join(" · ")}
      </p>
      {z && total > 0 && (
        <div className="mt-3">
          <svg viewBox="0 0 300 18" className="w-full" role="img"
            aria-label={`Time in zone: ${z.map((s, i) => `${ZONES[i]} ${Math.round(s / 60)} min`).join(", ")}`}>
            {(() => {
              let x = 0;
              return z.map((s, i) => {
                const w = (s / total) * 300;
                const el = w > 0 ? <rect key={i} x={x} y="0" width={w} height="18" fill="var(--accent)" fillOpacity={OPACITY[i]} stroke="var(--card)" strokeWidth="2" /> : null;
                x += w;
                return el;
              });
            })()}
          </svg>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted">
            {z.map((s, i) => (
              <li key={i} className="flex items-center gap-1">
                <svg width="8" height="8" aria-hidden="true"><rect width="8" height="8" rx="2" fill="var(--accent)" fillOpacity={OPACITY[i]} /></svg>
                {ZONES[i]} {Math.round(s / 60)} min
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
