import { useState } from 'react';
import type { SetType } from '../types';
import { SET_TYPES } from '../setTypes';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

/** Pick a set type. Each row has a "?" that explains how to do it and how it's counted. */
export function SetTypeSheet({ value, onPick, onClose }: { value: SetType; onPick: (t: SetType) => void; onClose: () => void }) {
  const [open, setOpen] = useState<SetType | null>(null);
  return (
    <Sheet title="Set type" onClose={onClose}>
      <div className="type-list">
        {SET_TYPES.map((t) => (
          <div key={t.id} className={`type-row ${t.id} ${value === t.id ? 'on' : ''}`}>
            <div className="type-main">
              <button className="type-pick" onClick={() => onPick(t.id)}>
                <b>{t.label}</b>
                <small>{t.short}</small>
              </button>
              <button className={`help-btn ${open === t.id ? 'on' : ''}`} aria-label={`What is ${t.label}?`} aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>
                ?
              </button>
            </div>
            {open === t.id && (
              <div className="type-help">
                <p>
                  <b>How:</b> {t.how}
                </p>
                <p>
                  <b>How MyoForge counts it:</b> {t.counts}
                </p>
              </div>
            )}
            {value === t.id && <Icon name="check" size={16} className="type-check" />}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
