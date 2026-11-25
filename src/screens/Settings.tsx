import { useEffect, useRef, useState } from 'react';
import { db, exportJSON, importJSON, initDB } from '../db';
import { useLocal } from '../store';
import { REFERENCES, WARMUP_DEFAULT_PCT } from '../science';
import type { Unit } from '../types';
import { Icon } from '../components/Icon';
import { BUILD, PLATFORM, canUpdate, checkForUpdate, openUpdate } from '../update';

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [unit, setUnit] = useLocal<Unit>('unit', 'lb');
  const [warmPct, setWarmPct] = useLocal('warmupPct', WARMUP_DEFAULT_PCT);
  const [msg, setMsg] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const backup = async () => {
    const text = await exportJSON();
    const name = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const f = new File([text], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: name });
        setMsg('Backup shared.');
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg('Backup downloaded.');
  };

  const restore = async (f?: File) => {
    if (!f) return;
    if (!confirm('This replaces ALL current data with the backup. Continue?')) return;
    try {
      await importJSON(await f.text());
      setMsg('Backup restored.');
    } catch (e) {
      setMsg(`Restore failed: ${(e as Error).message}`);
    }
  };

  const wipe = async () => {
    if (!confirm('Delete ALL workouts, plans and custom exercises? This cannot be undone.')) return;
    await Promise.all([db.sets.clear(), db.workouts.clear(), db.exercises.clear(), db.plans.clear()]);
    await initDB();
    localStorage.clear();
    location.reload();
  };

  return (
    <div className="overlay">
      <header className="topbar">
        <button className="btn ghost" onClick={onClose}>
          <Icon name="back" size={18} /> Back
        </button>
        <h1>Settings</h1>
        <span className="topbar-spacer" />
      </header>
      <div className="overlay-scroll">
        <div className="screen">
          <section className="card">
            <span className="label">Units</span>
            <div className="seg">
              {(['lb', 'kg'] as Unit[]).map((u) => (
                <button key={u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>
                  {u}
                </button>
              ))}
            </div>
            <small className="muted">Stored in kg, so switching never loses precision.</small>
          </section>

          <section className="card">
            <div className="row-between">
              <span className="label">Warm-up set</span>
              <b className="mono">{Math.round(warmPct * 100)}% × 5</b>
            </div>
            <input type="range" min={0.5} max={0.8} step={0.05} value={warmPct} onChange={(e) => setWarmPct(Number(e.target.value))} aria-label="Warm-up percentage" />
            <small className="muted">One lighter set before your first working set, rounded to loadable plates. 60–80% is the evidence-backed range; one very light set did worst in testing.</small>
          </section>

          <section className="card">
            <span className="label">Your data</span>
            <p className="muted sm">Everything lives on this device only. Back up regularly, since it's your only copy.</p>
            <button className="btn secondary big" onClick={backup}>
              Export backup
            </button>
            <button className="btn secondary big" onClick={() => file.current?.click()}>
              Restore from backup
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
            <small className="muted">Protected from storage cleanup: {persisted == null ? 'unknown' : persisted ? 'yes' : 'not guaranteed'}</small>
            {msg && <div className="msg">{msg}</div>}
          </section>

          <AppVersion />

          <section className="card">
            <span className="label">
              <Icon name="book" size={14} /> The science
            </span>
            <p className="muted sm">What the body map, stall flags and suggestions are built on. Rules live in src/science.ts.</p>
            <div className="refs">
              {REFERENCES.map((r, i) => (
                <a key={i} className="ref" href={r.url} target="_blank" rel="noreferrer">
                  <div className="row-between">
                    <span className="ref-topic">{r.topic}</span>
                    <span className={`conf c-${r.confidence.toLowerCase()}`}>{r.confidence}</span>
                  </div>
                  <p>{r.claim}</p>
                  <small>{r.cite}</small>
                </a>
              ))}
            </div>
          </section>

          <section className="card">
            <span className="label">Danger zone</span>
            <button className="btn link danger" onClick={wipe}>
              Erase everything
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function AppVersion() {
  const [status, setStatus] = useState('');
  const [newer, setNewer] = useState(0);
  const check = async () => {
    setStatus('Checking…');
    const r = await checkForUpdate(true);
    if (r === 'error') setStatus("Couldn't reach GitHub. Check your connection.");
    else if (r) {
      setNewer(r.build);
      setStatus(`Build ${r.build} is available${r.notes ? `: ${r.notes}` : '.'}`);
    } else setStatus("You're on the latest build.");
  };
  return (
    <section className="card">
      <div className="row-between">
        <span className="label">App version</span>
        <b className="mono">{BUILD ? `build ${BUILD}` : 'web'}</b>
      </div>
      {canUpdate() ? (
        <>
          <small className="muted">Checks for new builds automatically every few hours. Updating keeps your data.</small>
          <button className="btn secondary big" onClick={check}>
            Check for updates
          </button>
          {newer > 0 && (
            <button className="btn primary big" onClick={openUpdate}>
              {PLATFORM === 'ios' ? 'Open AltStore' : 'Download update'}
            </button>
          )}
          {status && <div className="msg">{status}</div>}
        </>
      ) : (
        <small className="muted">The web version updates itself when you reload.</small>
      )}
    </section>
  );
}
