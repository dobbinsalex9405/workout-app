import { BUILD, PLATFORM } from './update';
import { setLocal } from './store';

/**
 * Feedback goes straight to the developer's laptop (scripts/feedback-server.mjs behind
 * Tailscale Funnel). The laptop may be asleep, so every message waits in an outbox on the
 * phone and is resent on launch / when the app comes back to the front until it's delivered.
 * Only what you type is sent, plus the app build and platform. No workout data.
 */
const ENDPOINT = 'https://alexs-laptop.tail1c2d96.ts.net:8443/feedback';
const KEY = 'feedback.outbox';

export type FeedbackCategory = 'bug' | 'idea' | 'other';
export interface FeedbackItem {
  id: string;
  ts: number;
  category: FeedbackCategory;
  text: string;
  contact: string;
}

const read = (): FeedbackItem[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
};
const write = (items: FeedbackItem[]) => setLocal(KEY, items);

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function post(item: FeedbackItem): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, build: BUILD, platform: PLATFORM }),
      signal: ctrl.signal,
    });
    window.clearTimeout(t);
    // 4xx other than rate limiting means the message itself is unacceptable; don't retry forever.
    return r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429);
  } catch {
    return false;
  }
}

let flushing = false;
/** Try to deliver everything waiting. Returns how many are still waiting. */
export async function flushFeedback(): Promise<number> {
  if (flushing) return read().length;
  flushing = true;
  try {
    for (const item of read()) {
      if (await post(item)) write(read().filter((x) => x.id !== item.id));
      else break; // laptop unreachable: try again later
    }
  } finally {
    flushing = false;
  }
  return read().length;
}

/** Queue a message and try to send it now. Resolves true if it was delivered right away. */
export async function sendFeedback(category: FeedbackCategory, text: string, contact: string): Promise<boolean> {
  const item: FeedbackItem = { id: newId(), ts: Date.now(), category, text: text.trim(), contact: contact.trim() };
  write([...read(), item]);
  const left = await flushFeedback();
  return !read().some((x) => x.id === item.id) || left === 0;
}
