import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocal } from './store';
import { WorkoutScreen, autoEndStaleWorkout } from './screens/Workout';
import { PlansScreen } from './screens/Plans';
import { ProgressScreen } from './screens/Progress';
import { BodyScreen } from './screens/Body';
import { HistoryScreen } from './screens/History';
import { SettingsScreen } from './screens/Settings';
import { PRFlash } from './components/PRFlash';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Icon, type IconName } from './components/Icon';
import { checkForUpdate } from './update';
import { flushFeedback } from './feedback';
import { LaunchIntro } from './components/LaunchIntro';
import { Guide, WHATS_NEW_ID } from './components/Guide';
import { db } from './db';

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'workout', label: 'Workout', icon: 'workout' },
  { id: 'plans', label: 'Plans', icon: 'plans' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'body', label: 'Body', icon: 'body' },
  { id: 'history', label: 'History', icon: 'history' },
];

export default function App() {
  const [tab, setTab] = useLocal<string>('ui.tab', 'workout');
  const [settings, setSettings] = useLocal('ui.settings', false);
  const main = useRef<HTMLElement>(null);
  // Launch animation: once per app start (not when switching back to the app), unless turned off.
  const [introOn] = useLocal('intro.enabled', true);
  const [intro, setIntro] = useState(() => (introOn && !sessionStorage.getItem('intro.shown')) || location.search.includes('introAt='));
  const endIntro = useCallback(() => {
    sessionStorage.setItem('intro.shown', '1');
    setIntro(false);
  }, []);

  // Guide / What's new: opened from the top bar or Settings, and once automatically.
  const [guide, setGuide] = useLocal<'guide' | 'whatsnew' | null>('ui.guide', null);
  useEffect(() => {
    if (intro) return;
    if (localStorage.getItem('whatsnew.seen') === WHATS_NEW_ID) return;
    void db.workouts.count().then((n) => {
      // New here: the full guide. Been using the app: just what changed.
      if (!localStorage.getItem('guide.seen') && n === 0) setGuide('guide');
      else setGuide('whatsnew');
    });
  }, [intro, setGuide]);
  const closeGuide = () => {
    localStorage.setItem('guide.seen', '1');
    localStorage.setItem('whatsnew.seen', WHATS_NEW_ID);
    setGuide(null);
  };
  const idx = Math.max(0, TABS.findIndex((t) => t.id === tab));

  // Restore scroll position per tab (survives reloads), and remember it as you scroll.
  useEffect(() => {
    const el = main.current;
    if (!el) return;
    const saved = Number(localStorage.getItem(`scroll.${tab}`) ?? 0);
    // Data loads asynchronously, so keep trying for up to ~1.5s until the page is tall enough.
    // Stops early if the user touches the screen.
    let r = 0;
    let tries = 0;
    let restoring = saved > 0;
    const restore = () => {
      if (!restoring) return;
      if (el.scrollHeight - el.clientHeight >= saved || tries > 90) {
        el.scrollTop = saved;
        restoring = false;
        return;
      }
      tries++;
      r = requestAnimationFrame(restore);
    };
    el.scrollTop = 0;
    r = requestAnimationFrame(restore);
    const stop = () => (restoring = false);
    let t: number | undefined;
    const onScroll = () => {
      if (restoring) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => localStorage.setItem(`scroll.${tab}`, String(el.scrollTop)), 150);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('wheel', stop, { passive: true });
    return () => {
      cancelAnimationFrame(r);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('wheel', stop);
      window.clearTimeout(t);
    };
  }, [tab]);

  // Close a forgotten workout: on launch, when the app comes back to the front, and every minute.
  useEffect(() => {
    const check = () => {
      void autoEndStaleWorkout();
      void checkForUpdate();
      void flushFeedback();
    };
    check();
    const t = window.setInterval(check, 60000);
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const go = (id: string) => {
    if (id === tab) main.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setTab(id);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1 key={tab} className="topbar-title">
          {TABS[idx].label}
        </h1>
        <button className="icon-btn" aria-label="Guide" onClick={() => setGuide('guide')}>
          <Icon name="book" size={21} />
        </button>
        <button className="icon-btn" aria-label="Settings" onClick={() => setSettings(true)}>
          <Icon name="settings" size={22} />
        </button>
      </header>
      <main ref={main}>
        <div key={tab} className="screen-anim">
          <ErrorBoundary>
            {tab === 'workout' && <WorkoutScreen />}
            {tab === 'plans' && <PlansScreen />}
            {tab === 'progress' && <ProgressScreen />}
            {tab === 'body' && <BodyScreen />}
            {tab === 'history' && <HistoryScreen />}
          </ErrorBoundary>
        </div>
      </main>
      <nav className="tabbar" style={{ ['--i' as string]: idx, ['--n' as string]: TABS.length }}>
        <span className="tab-pill" />
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <Icon name={t.icon} size={22} />
            <small>{t.label}</small>
          </button>
        ))}
      </nav>
      {settings && <SettingsScreen onClose={() => setSettings(false)} />}
      <PRFlash />
      {guide && !intro && <Guide whatsNew={guide === 'whatsnew'} onClose={closeGuide} />}
      {intro && <LaunchIntro onDone={endIntro} />}
    </div>
  );
}
