import { useMemo, useState } from 'react';
import { fmtDateLong, fmtN, startOfDay, startOfWeek } from '../calc';

/**
 * Training calendar: one column per week, Mon→Sun top to bottom.
 * Columns are 1fr so it always fits the screen width; no sideways scrolling.
 */
export function Heatmap({ days, weeks = 18, unit }: { days: Map<number, { volume: number; workouts: number }>; weeks?: number; unit: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const today = startOfDay(Date.now());
  // Calendar arithmetic, not ms arithmetic: subtracting 24h blocks drifts off midnight across DST changes.
  const s0 = new Date(startOfWeek(today));
  s0.setDate(s0.getDate() - (weeks - 1) * 7);
  const start = s0.getTime();

  const { cells, months, max } = useMemo(() => {
    const cells: { ts: number; v: number; n: number; future: boolean }[] = [];
    let max = 0;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        // Build from calendar dates rather than adding 24h, so DST shifts can't skew days.
        const dt = new Date(start);
        dt.setDate(dt.getDate() + w * 7 + d);
        const ts = dt.getTime();
        const info = days.get(ts);
        const v = info?.volume ?? 0;
        max = Math.max(max, v);
        cells.push({ ts, v, n: info?.workouts ?? 0, future: ts > today });
      }
    }
    const months: { col: number; label: string }[] = [];
    let lastM = -1;
    for (let w = 0; w < weeks; w++) {
      const m = new Date(cells[w * 7].ts).getMonth();
      if (m !== lastM) {
        // A label needs ~3 columns; drop the previous one if this month starts too close to it.
        const prev = months[months.length - 1];
        if (prev && w + 1 - prev.col < 3) months.pop();
        if (w < weeks - 2) months.push({ col: w + 1, label: new Date(cells[w * 7].ts).toLocaleDateString(undefined, { month: 'short' }) });
        lastM = m;
      }
    }
    return { cells, months, max };
  }, [days, weeks, start, today]);

  const level = (v: number) => (v <= 0 ? 0 : max <= 0 ? 1 : Math.min(4, 1 + Math.floor((v / max) * 3.999)));
  const shown = cells.find((c) => c.ts === sel);
  const active = cells.filter((c) => c.n > 0 && !c.future).length;

  return (
    <div className="heat">
      <div className="heat-head">
        <span className="label">Training days</span>
        <span className="heat-read">
          {shown ? (
            <>
              {fmtDateLong(shown.ts)} · {shown.n ? `${fmtN(shown.v)} ${unit}` : 'rest'}
            </>
          ) : (
            <>
              {active} in {weeks} weeks
            </>
          )}
        </span>
      </div>
      <div className="heat-months" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {months.map((m) => (
          <span key={m.col} style={{ gridColumn: `${m.col} / span ${Math.min(3, weeks - m.col + 1)}` }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="heat-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {cells.map((c) => (
          <button
            key={c.ts}
            className={`hc l${level(c.v)} ${c.future ? 'future' : ''} ${c.ts === today ? 'today' : ''} ${sel === c.ts ? 'sel' : ''}`}
            onClick={() => !c.future && setSel(sel === c.ts ? null : c.ts)}
            aria-label={fmtDateLong(c.ts)}
          />
        ))}
      </div>
      <div className="heat-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`hc l${l}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
