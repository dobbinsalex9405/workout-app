import { useState } from 'react';
import { MUSCLES, MUSCLE_IDS, PRIMARY_SET, SECONDARY_SET } from '../science';
import type { Muscle } from '../types';
import { BodyMap, heat } from './BodyMap';

export type MuscleSplit = { primary: Muscle[]; secondary: Muscle[] };

const P_COLOR = '#4fd2ff';
const S_COLOR = '#2456b8';

/**
 * Pick primary and secondary muscles by painting: choose a brush, then tap muscles on
 * the map or in the list. Tapping a muscle that already has the current brush clears it.
 * A muscle is never both.
 */
export function MuscleEditor({ value, onChange }: { value: MuscleSplit; onChange: (v: MuscleSplit) => void }) {
  const [brush, setBrush] = useState<'primary' | 'secondary'>('primary');
  const { primary, secondary } = value;

  const apply = (m: Muscle) => {
    const had = (brush === 'primary' ? primary : secondary).includes(m);
    const p = primary.filter((x) => x !== m);
    const s = secondary.filter((x) => x !== m);
    if (!had) (brush === 'primary' ? p : s).push(m);
    onChange({ primary: p, secondary: s });
  };

  const values: Partial<Record<Muscle, number>> = {};
  secondary.forEach((m) => (values[m] = 0.5));
  primary.forEach((m) => (values[m] = 1));
  const color = (_m: Muscle, v: number) => (v >= 1 ? P_COLOR : v > 0 ? S_COLOR : heat(0));
  const names = (l: Muscle[]) => l.map((m) => MUSCLES[m].name).join(', ');

  return (
    <div className="muscle-editor">
      <div className="seg brush">
        <button className={brush === 'primary' ? 'on' : ''} onClick={() => setBrush('primary')}>
          <i className="swatch" style={{ background: P_COLOR }} /> Primary
        </button>
        <button className={brush === 'secondary' ? 'on' : ''} onClick={() => setBrush('secondary')}>
          <i className="swatch" style={{ background: S_COLOR }} /> Secondary
        </button>
      </div>
      <p className="fine center">
        Tap muscles to mark them <b>{brush}</b>. Tap again to clear.
      </p>
      <BodyMap values={values} selected={null} onSelect={apply} color={color} storeKey="editor.view" />
      <div className="chips wrap">
        {MUSCLE_IDS.map((m) => {
          const st = primary.includes(m) ? 'p' : secondary.includes(m) ? 's' : '';
          return (
            <button key={m} className={`chip mchip ${st}`} onClick={() => apply(m)}>
              {MUSCLES[m].name}
              {st && <small>{st === 'p' ? '1' : '½'}</small>}
            </button>
          );
        })}
      </div>
      <div className="split-summary">
        <div>
          <span className="label">Primary · {PRIMARY_SET} set</span>
          <span className={primary.length ? '' : 'muted'}>{names(primary) || 'None yet: pick at least one'}</span>
        </div>
        <div>
          <span className="label">Secondary · ½ set</span>
          <span className={secondary.length ? '' : 'muted'}>{names(secondary) || 'None'}</span>
        </div>
      </div>
      <p className="fine">
        Each logged set counts as {PRIMARY_SET} set for primary muscles and {SECONDARY_SET} for secondary ones, in the Body map and volume advice (fractional set counting, Pelland 2024).
      </p>
    </div>
  );
}
