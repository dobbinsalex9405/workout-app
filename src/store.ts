import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tiny persistent state: every value is mirrored to localStorage on each change,
 * so if the OS kills or reloads the webview you come back to the exact same
 * screen, exercise, and half-typed weight/reps.
 */
const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function read<T>(key: string, init: T): T {
  if (!cache.has(key)) {
    try {
      const raw = localStorage.getItem(key);
      cache.set(key, raw == null ? init : JSON.parse(raw));
    } catch {
      cache.set(key, init);
    }
  }
  return cache.get(key) as T;
}

export function useLocal<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(cb);
      return () => set!.delete(cb);
    },
    [key],
  );
  const value = useSyncExternalStore(subscribe, () => read(key, init));
  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(read(key, init)) : v;
      cache.set(key, next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage full: state still works in memory */
      }
      listeners.get(key)?.forEach((f) => f());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

/** Set a persisted value from outside React (screens using `useLocal(key)` update immediately). */
export function setLocal<T>(key: string, value: T) {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full */
  }
  listeners.get(key)?.forEach((f) => f());
}

/* ---------- PR flash (not persisted) ---------- */

export interface PRFlashData {
  exercise: string;
  kinds: string[];
  detail: string;
}

let current: PRFlashData | null = null;
const flashListeners = new Set<() => void>();

export function showPR(d: PRFlashData | null) {
  current = d;
  flashListeners.forEach((f) => f());
}

export function usePRFlash() {
  return useSyncExternalStore(
    (cb) => {
      flashListeners.add(cb);
      return () => flashListeners.delete(cb);
    },
    () => current,
  );
}
