import { useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/**
 * The quick guide (tap the book icon in the top bar, or Settings → Guide), and the "What's new"
 * card shown once to people who already used the app when they get this update.
 */

type Page = { icon: IconName; title: string; body: ReactNode };

const GUIDE: Page[] = [
  {
    icon: 'workout',
    title: 'Welcome to MyoForge',
    body: (
      <>
        <p>A workout tracker built on exercise science. It logs your lifts, shows what each muscle has done, and learns how you train.</p>
        <p>Everything stays on your phone. Swipe through for the 1-minute tour, or tap Skip.</p>
      </>
    ),
  },
  {
    icon: 'plus',
    title: 'Log a workout',
    body: (
      <ul>
        <li>
          <b>Workout tab:</b> start empty, from a plan, or repeat your last workout.
        </li>
        <li>
          <b>Add exercise</b>, type weight × reps, tap <b>Log</b>. Hints fill in what you did last time.
        </li>
        <li>Before your first set you get a one-tap <b>warm-up</b> suggestion.</li>
        <li>Forgot to finish? A workout ends on its own an hour after your last set.</li>
      </ul>
    ),
  },
  {
    icon: 'repeat',
    title: 'Set types',
    body: (
      <ul>
        <li>
          Tap the <b>Set</b> button next to the weight to switch: Warm-up, <b>Drop set</b>, <b>Myo-reps</b>, To failure.
        </li>
        <li>
          <b>Drop set:</b> log the first set, then tap <b>↘ Drop</b> for each lighter round.
        </li>
        <li>
          <b>Myo-reps:</b> log the activation set, then <b>+ Mini</b> for each quick mini-set.
        </li>
        <li>
          Each type has a <b>?</b> explaining how to do it and how it's counted.
        </li>
      </ul>
    ),
  },
  {
    icon: 'flame',
    title: 'RIR: reps in reserve',
    body: (
      <>
        <p>
          After a set, tap its <b>RIR</b> chip: how many more reps you could have done (0 = failure, 2 = two left in the tank).
        </p>
        <p>It's optional, but it makes the rest planner and the fatigue map much more accurate, because 8 reps with 2 left tells a different story than 8 all-out.</p>
      </>
    ),
  },
  {
    icon: 'history',
    title: 'Rest planner',
    body: (
      <>
        <p>
          While you rest, the exercise shows how many reps to expect next, a suggested rest, and, if you type a target, how long to rest to hit it.
        </p>
        <p>It learns how fast <i>you</i> tire on each exercise. It stays quiet until it has checked itself against your own history (about 6 sets over 3 sessions). Log sets as you do them so rest times are real.</p>
      </>
    ),
  },
  {
    icon: 'body',
    title: 'Body map',
    body: (
      <ul>
        <li>
          <b>Fatigue:</b> how worked each muscle is right now, and when it's ready again.
        </li>
        <li>
          <b>Volume:</b> hard sets per week vs the 10–20 range research supports.
        </li>
        <li>Tap a muscle for details. Flip front / side / back with the buttons or a swipe.</li>
      </ul>
    ),
  },
  {
    icon: 'progress',
    title: 'Progress & PRs',
    body: (
      <ul>
        <li>
          A <b>PR</b> is a new heaviest weight on an exercise.
        </li>
        <li>Each exercise has strength and volume graphs, your fatigue between sets, and your records.</li>
        <li>
          <b>Stalled</b> = 3 sessions and 2 weeks with no new best. Tap it for what to try.
        </li>
      </ul>
    ),
  },
  {
    icon: 'plans',
    title: 'Plans & your exercises',
    body: (
      <ul>
        <li>
          <b>Plans tab:</b> build plans, star exercises into <b>My exercises</b>, browse the library.
        </li>
        <li>Create your own exercises and set exactly which muscles are primary and secondary.</li>
        <li>
          The <b>pencil</b> on any exercise (in a workout, Progress, or History) edits its name and muscles everywhere.
        </li>
      </ul>
    ),
  },
  {
    icon: 'settings',
    title: 'Your data & feedback',
    body: (
      <ul>
        <li>Your data lives only on this phone. Use Settings → Export backup now and then.</li>
        <li>
          Settings → <b>Feedback</b> sends bugs and ideas straight to the developer.
        </li>
        <li>Updates show up as a banner on the Workout tab. Your data carries over.</li>
      </ul>
    ),
  },
];

/** Bump when there's a new "What's new" to show. */
export const WHATS_NEW_ID = 'myoforge-1';

const WHATS_NEW: Page = {
  icon: 'star',
  title: "What's new",
  body: (
    <ul>
      <li>
        <b>We're MyoForge now</b>, with a new icon and launch animation. All your data came with you.
      </li>
      <li>
        <b>Drop sets and myo-reps</b>, logged properly and counted fairly toward fatigue and volume. Tap the set type button to switch.
      </li>
      <li>
        <b>RIR</b> chip on every set (optional): how many reps you had left.
      </li>
      <li>
        <b>Rest planner:</b> expected reps and suggested rest while you rest, learned from your own sets.
      </li>
      <li>
        <b>PRs</b> now mean a new heaviest weight. Edit any exercise with the <b>pencil</b>.
      </li>
      <li>
        <b>Feedback</b> in Settings goes straight to the developer.
      </li>
    </ul>
  ),
};

export function Guide({ onClose, whatsNew = false }: { onClose: () => void; whatsNew?: boolean }) {
  const pages = whatsNew ? [WHATS_NEW] : GUIDE;
  const [i, setI] = useState(0);
  const [touch, setTouch] = useState<number | null>(null);
  const p = pages[i];
  const last = i === pages.length - 1;
  return (
    <div className="overlay guide" role="dialog" aria-modal="true" aria-label={whatsNew ? "What's new" : 'Guide'}>
      <header className="topbar">
        <span className="topbar-spacer" />
        <h1>{whatsNew ? "What's new" : 'Guide'}</h1>
        <button className="btn ghost" onClick={onClose}>
          {last ? 'Close' : 'Skip'}
        </button>
      </header>
      <div
        className="guide-body"
        onTouchStart={(e) => setTouch(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch == null) return;
          const dx = e.changedTouches[0].clientX - touch;
          if (dx < -50 && !last) setI(i + 1);
          if (dx > 50 && i > 0) setI(i - 1);
          setTouch(null);
        }}
      >
        <div key={i} className="guide-page">
          <div className="guide-icon">
            <Icon name={p.icon} size={34} />
          </div>
          <h2>{p.title}</h2>
          <div className="guide-text">{p.body}</div>
        </div>
      </div>
      <footer className="guide-foot">
        {pages.length > 1 && (
          <div className="guide-dots">
            {pages.map((_, k) => (
              <button key={k} className={k === i ? 'on' : ''} aria-label={`Page ${k + 1}`} onClick={() => setI(k)} />
            ))}
          </div>
        )}
        <div className="guide-nav">
          {i > 0 && (
            <button className="btn secondary" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button className="btn primary grow" onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? (whatsNew ? 'Got it' : "Let's lift") : 'Next'}
          </button>
        </div>
      </footer>
    </div>
  );
}
