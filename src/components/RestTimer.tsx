import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import { db } from '../db';
import { useLocal } from '../store';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Buzz the phone. iPhone needs the native haptics plugin (the web vibrate call does nothing there). */
async function buzz() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.vibrate({ duration: 500 });
      setTimeout(() => void Haptics.vibrate({ duration: 500 }), 700);
    } else navigator.vibrate?.([400, 250, 400]);
  } catch {
    /* no vibration available */
  }
}

/**
 * Rest timer pinned to the bottom of an active workout. Starts from your last logged set,
 * counts down (default 3:00, adjustable), and buzzes when it's time for the next set.
 * Works while the app is open; a locked/backgrounded phone pauses the app, so no buzz then.
 */
export function RestTimer({ workoutId }: { workoutId: number }) {
  const lastTs = useLiveQuery(async () => (await db.sets.where('workoutId').equals(workoutId).toArray()).reduce((m, s) => Math.max(m, s.ts), 0), [workoutId]) ?? 0;
  const [total, setTotal] = useLocal('rest.seconds', 180);
  const [hidden, setHidden] = useLocal('rest.hiddenFor', 0);
  const [now, setNow] = useState(Date.now());
  const buzzed = useRef(Number(localStorage.getItem('rest.buzzedFor') ?? 0));

  useEffect(() => {
    if (!lastTs) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [lastTs]);

  const elapsed = (now - lastTs) / 1000;
  const left = total - elapsed;
  // Buzz once per set when the countdown hits zero (not again after a reload).
  useEffect(() => {
    if (lastTs && left <= 0 && left > -5 && buzzed.current !== lastTs) {
      buzzed.current = lastTs;
      localStorage.setItem('rest.buzzedFor', String(lastTs));
      void buzz();
    }
  }, [left, lastTs]);

  if (!lastTs || hidden === lastTs || elapsed > total + 120) return null;
  const done = left <= 0;
  const pct = Math.min(1, Math.max(0, elapsed / total));
  return (
    <div className={`rest-timer ${done ? 'done' : ''}`} role="timer" aria-live="polite">
      <div className="rest-fill" style={{ transform: `scaleX(${pct})` }} />
      <button className="rest-adj" aria-label="30 seconds less" onClick={() => setTotal(Math.max(30, total - 30))}>
        −30
      </button>
      <div className="rest-mid">
        <small>{done ? 'Rest done' : 'Rest'}</small>
        <b>{done ? 'Next set!' : mmss(left)}</b>
      </div>
      <button className="rest-adj" aria-label="30 seconds more" onClick={() => setTotal(Math.min(600, total + 30))}>
        +30
      </button>
      <button className="rest-x" aria-label="Hide rest timer" onClick={() => setHidden(lastTs)}>
        ×
      </button>
    </div>
  );
}
