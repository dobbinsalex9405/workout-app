import { useState } from 'react';
import { fmtDate } from '../calc';

export interface Pt {
  x: number; // timestamp
  y: number;
}

interface Props {
  title: string;
  points: Pt[];
  kind?: 'line' | 'bar';
  color?: string;
  format: (y: number) => string;
  unitLabel?: string;
}

const W = 320;
const H = 150;
const P = { l: 8, r: 8, t: 10, b: 20 };

export function Chart({ title, points, kind = 'line', color = 'var(--accent)', format, unitLabel }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const n = points.length;
  const idx = sel != null && sel < n ? sel : n - 1;
  const shown = points[idx];

  let body: React.ReactNode = <div className="empty">Not enough data yet</div>;

  if (n > 0) {
    const ys = points.map((p) => p.y);
    const maxY = Math.max(...ys);
    const minY = kind === 'bar' ? 0 : Math.min(...ys);
    const span = maxY - minY || 1;
    const pad = kind === 'bar' ? 0 : span * 0.15;
    const lo = minY - pad;
    const hi = maxY + pad;
    const iw = W - P.l - P.r;
    const ih = H - P.t - P.b;
    const t0 = points[0].x;
    const t1 = points[n - 1].x;
    const xAt = (i: number) =>
      kind === 'bar'
        ? P.l + ((i + 0.5) / n) * iw
        : n === 1 || t1 === t0
          ? P.l + iw / 2
          : P.l + ((points[i].x - t0) / (t1 - t0)) * iw;
    const yAt = (v: number) => P.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

    const nearest = (clientX: number, el: SVGSVGElement) => {
      const r = el.getBoundingClientRect();
      const x = ((clientX - r.left) / r.width) * W;
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(xAt(i) - x);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    };

    const line = points.map((_, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(points[i].y).toFixed(1)}`).join(' ');
    const area = `${line} L${xAt(n - 1).toFixed(1)},${H - P.b} L${xAt(0).toFixed(1)},${H - P.b} Z`;
    const bw = Math.max(3, Math.min(26, (iw / n) * 0.7));
    const gid = `g${title.replace(/\W/g, '')}`;

    body = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        onPointerDown={(e) => setSel(nearest(e.clientX, e.currentTarget))}
        onPointerMove={(e) => e.buttons && setSel(nearest(e.clientX, e.currentTarget))}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="var(--line)" />
        {kind === 'line' ? (
          <>
            {n > 1 && <path d={area} fill={`url(#${gid})`} />}
            {n > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
            {points.map((p, i) => (
              <circle key={i} cx={xAt(i)} cy={yAt(p.y)} r={i === idx ? 5 : 2.6} fill={i === idx ? '#fff' : color} stroke={color} strokeWidth={i === idx ? 2.5 : 0} />
            ))}
          </>
        ) : (
          points.map((p, i) => (
            <rect
              key={i}
              x={xAt(i) - bw / 2}
              y={yAt(p.y)}
              width={bw}
              height={Math.max(1, H - P.b - yAt(p.y))}
              rx="2"
              fill={color}
              opacity={i === idx ? 1 : 0.5}
            />
          ))
        )}
        <text x={P.l} y={H - 5} className="axis">
          {fmtDate(points[0].x)}
        </text>
        <text x={W - P.r} y={H - 5} className="axis" textAnchor="end">
          {n > 1 ? fmtDate(points[n - 1].x) : ''}
        </text>
      </svg>
    );
  }

  return (
    <section className="card chart">
      <div className="chart-head">
        <h3>{title}</h3>
        {shown && (
          <div className="readout">
            <b>{format(shown.y)}</b>
            {unitLabel && <small> {unitLabel}</small>}
            <small> · {fmtDate(shown.x)}</small>
          </div>
        )}
      </div>
      {body}
    </section>
  );
}

export function Sparkline({ values, color = 'var(--accent)' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <svg className="spark" viewBox="0 0 60 22" />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const d = values
    .map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1)) * 58 + 1},${20 - ((v - lo) / (hi - lo || 1)) * 18}`)
    .join(' ');
  return (
    <svg className="spark" viewBox="0 0 60 22">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
