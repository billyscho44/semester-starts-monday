// Server-rendered SVG charts. Colors come from the app's CSS tokens so light and dark both work.
const W = 320;
const H = 150;
const PAD = { l: 34, r: 12, t: 12, b: 24 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export type Bar = { label: string; value: number };

export function BarChart({ data, unit, title }: { data: Bar[]; unit: string; title: string }) {
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const bw = Math.min(40, iw / data.length - 10);
  const step = iw / data.length;
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const last = data.length - 1;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${data.map((d) => `${d.label} ${d.value} ${unit}`).join(", ")}`} className="w-full">
        {[0, max / 2, max].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(g)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.l + step * i + (step - bw) / 2;
          const h = Math.max(d.value > 0 ? 2 : 0, ih - (y(d.value) - PAD.t));
          return (
            <g key={d.label}>
              <rect x={x} y={PAD.t + ih - h} width={bw} height={h} rx="4" fill="var(--accent)" />
              <rect x={x} y={PAD.t + ih - 4} width={bw} height="4" fill="var(--accent)" />
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.label}</text>
              {i === last && (
                <text x={x + bw / 2} y={PAD.t + ih - h - 4} textAnchor="middle" fontSize="11" fill="var(--ink)">{d.value}</text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export type Stack = { label: string; easy: number; average: number; hard: number };

export function StackedBars({ data, title }: { data: Stack[]; title: string }) {
  const totals = data.map((d) => d.easy + d.average + d.hard);
  const max = niceMax(Math.max(...totals, 0));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const step = iw / data.length;
  const bw = Math.min(40, step - 10);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const tones = [["easy", 0.35], ["average", 0.65], ["hard", 1]] as const;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${title}. ${data.map((d) => `${d.label}: ${d.easy} easy, ${d.average} average, ${d.hard} hard`).join("; ")}`}
        className="w-full">
        {[0, max].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{g}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.l + step * i + (step - bw) / 2;
          let acc = 0;
          return (
            <g key={d.label}>
              {tones.map(([k, op]) => {
                const v = d[k];
                const top = y(acc + v);
                const h = y(acc) - top;
                acc += v;
                return v > 0 ? (
                  <rect key={k} x={x} y={top} width={bw} height={h} fill="var(--accent)" fillOpacity={op} stroke="var(--card)" strokeWidth="2" />
                ) : null;
              })}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-muted">
        {tones.map(([k, op]) => (
          <span key={k} className="flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden="true"><rect width="10" height="10" rx="2" fill="var(--accent)" fillOpacity={op} /></svg>
            {k[0].toUpperCase() + k.slice(1)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export type Pt = { x: number; y: number; label: string };

export function LineChart({
  points, avg, unit, title,
}: { points: Pt[]; avg?: Pt[]; unit: string; title: string }) {
  const all = [...points, ...(avg ?? [])];
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  const span = Math.max(maxY - minY, 2);
  const lo = Math.floor(minY - span * 0.15);
  const hi = Math.ceil(maxY + span * 0.15);
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x), minX + 1);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const sx = (x: number) => PAD.l + ((x - minX) / (maxX - minX)) * iw;
  const sy = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
  const line = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const shown = avg && avg.length > 1 ? avg : points;
  const last = shown[shown.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${title}. ${points.map((p) => `${p.label} ${p.y} ${unit}`).join(", ")}`} className="w-full">
        {[lo, (lo + hi) / 2, hi].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(g)} y2={sy(g)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.l - 6} y={sy(g) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(g)}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 8} fontSize="10" fill="var(--muted)">{points[0].label}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="10" fill="var(--muted)">{points[points.length - 1].label}</text>
        {avg && avg.length > 1 && <path d={line(points)} fill="none" stroke="var(--muted)" strokeWidth="1" strokeOpacity="0.6" />}
        {points.map((p) => (
          <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r="3" fill="var(--muted)" stroke="var(--card)" strokeWidth="2" />
        ))}
        <path d={line(shown)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={sx(last.x)} cy={sy(last.y)} r="4" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
        <text x={sx(last.x)} y={sy(last.y) - 9} textAnchor="end" fontSize="11" fill="var(--ink)">{last.y}</text>
      </svg>
      {avg && avg.length > 1 && (
        <figcaption className="mt-1 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="3" fill="var(--muted)" /></svg>Daily
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="10" aria-hidden="true"><line x1="0" y1="5" x2="14" y2="5" stroke="var(--accent)" strokeWidth="2" /></svg>7-day average
          </span>
        </figcaption>
      )}
    </figure>
  );
}

export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-muted">·</span>;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const w = 56;
  const h = 20;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`);
  return (
    <svg width={w} height={h} role="img" aria-label={`Trend: ${values.join(", ")}`}>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
