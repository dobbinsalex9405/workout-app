import { useEffect } from 'react';
import { showPR, usePRFlash } from '../store';
import { Icon } from './Icon';

const SPARKS = Array.from({ length: 30 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.07,
  dur: 1.2 + (i % 5) * 0.2,
  color: ['#2f7bff', '#35c8ff', '#e8f3ff', '#7aa8ff'][i % 4],
}));

export function PRFlash() {
  const pr = usePRFlash();

  useEffect(() => {
    if (!pr) return;
    try {
      navigator.vibrate?.([60, 40, 120]);
    } catch {
      /* iOS has no vibrate */
    }
    const t = setTimeout(() => showPR(null), 2800);
    return () => clearTimeout(t);
  }, [pr]);

  if (!pr) return null;
  return (
    <div className="pr-flash" onClick={() => showPR(null)}>
      <div className="pr-ring" />
      <div className="pr-ring r2" />
      {SPARKS.map((c, i) => (
        <i key={i} className="pr-spark"style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, background: c.color }} />
      ))}
      <div className="pr-card">
        <div className="pr-icon">
          <Icon name="trophy" size={56} />
        </div>
        <div className="pr-title">NEW PR</div>
        <div className="pr-ex">{pr.exercise}</div>
        <div className="pr-detail">{pr.detail}</div>
        {pr.kinds.length > 0 && (
          <div className="pr-kinds">
            {pr.kinds.map((k) => (
              <span key={k}>{k}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
