import { Capacitor } from '@capacitor/core';
import { setLocal } from './store';

/**
 * Update check for the installed (native) app. Each cloud build is a GitHub release
 * named `build-N`; the app knows its own N from build time and compares.
 * Only the public release list is fetched: nothing about you or your data is sent.
 */
declare const __BUILD__: number;
export const BUILD = typeof __BUILD__ === 'number' ? __BUILD__ : 0;
export const PLATFORM = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

const REPO = 'dobbinsalex9405/workout-app';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
export const APK_URL = `https://github.com/${REPO}/releases/latest/download/WorkoutApp.apk`;
const EVERY_MS = 6 * 3600_000;

export interface UpdateInfo {
  build: number;
  notes: string;
  date: string;
}

/** Native builds from the cloud know their number; the web version updates itself. */
export const canUpdate = () => PLATFORM !== 'web' && BUILD > 0;

/** Check GitHub (at most every 6 hours unless forced). Result lands in `update.available`. */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null | 'error'> {
  if (!canUpdate()) return null;
  const last = Number(localStorage.getItem('update.lastCheck') ?? 0);
  if (!force && Date.now() - last < EVERY_MS) return null;
  try {
    const r = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    localStorage.setItem('update.lastCheck', String(Date.now()));
    const build = Number(String(j.tag_name ?? '').replace('build-', ''));
    if (!build || build <= BUILD) {
      setLocal('update.available', null);
      return null;
    }
    const firstLine = String(j.body ?? '').split('\n')[0];
    const info: UpdateInfo = {
      build,
      notes: firstLine.startsWith("What's new:") ? firstLine.slice(11).trim() : '',
      date: j.published_at ?? '',
    };
    setLocal('update.available', info);
    return info;
  } catch {
    return 'error';
  }
}

/** Start the update: Android downloads the APK, iPhone opens AltStore. */
export function openUpdate() {
  window.open(PLATFORM === 'ios' ? 'altstore://' : APK_URL, '_system');
}
