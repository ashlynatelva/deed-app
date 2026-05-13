"use client";

import * as React from "react";

/**
 * Centralized persistent-store utility for the demo.
 *
 * Implements the contract `useSyncExternalStore` requires:
 *
 *   1. `getSnapshot()` returns the same reference until a real mutation occurs.
 *      Mutations always allocate a new top-level object so React detects them.
 *   2. `getServerSnapshot()` returns a stable, cached seed — calling it twice
 *      yields the same reference. (Returning a freshly-built object here is
 *      what triggers React's "infinite loop" warning.)
 *   3. `subscribe(cb)` is registered against a single module-level set; calling
 *      it does not allocate per-render closures.
 *
 * The store also mirrors itself to `localStorage` for demo persistence and
 * listens to the cross-tab `storage` event so two open tabs stay in sync.
 */

export type CreateStoreOptions<T> = {
  /** localStorage key. Use a versioned suffix so schema changes can invalidate. */
  storageKey: string;
  /**
   * Stable seed. Used for the initial state AND as the server snapshot.
   * Must be a stable reference (declare it as a module-level constant).
   */
  seed: T;
  /**
   * Optional validator/migrator. Return the parsed value to accept it; return
   * null to reject (the store will fall back to the seed). Default: pass-through.
   */
  parse?: (raw: unknown) => T | null;
};

export type PersistentStore<T> = {
  /** Stable across all renders. */
  subscribe: (cb: () => void) => () => void;
  /** Returns the current snapshot — same reference until a mutation. */
  getSnapshot: () => T;
  /** Returns the cached seed; same reference on every call. */
  getServerSnapshot: () => T;
  /** Read the current value synchronously. Use in action helpers, not in render. */
  getState: () => T;
  /** Apply a mutation. No-op (and no notification) if the value is unchanged. */
  setState: (updater: T | ((current: T) => T)) => void;
  /** Idempotent. The hook calls this on first mount. */
  hydrate: () => void;
  /** True once `hydrate()` has actually read from storage. */
  isHydrated: () => boolean;
};

const noopParser = <T>(raw: unknown): T => raw as T;

export function createPersistentStore<T>(opts: CreateStoreOptions<T>): PersistentStore<T> {
  // ─── Internals ─────────────────────────────────────────────────────────
  let state: T = opts.seed;
  let hydrated = false;
  const subscribers = new Set<() => void>();
  const parse = opts.parse ?? noopParser<T>;

  const emit = () => {
    subscribers.forEach((fn) => fn());
  };

  const persist = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(opts.storageKey, JSON.stringify(state));
    } catch {
      // Quota exceeded / privacy mode — fall back to in-memory only.
    }
  };

  // ─── Hydration ─────────────────────────────────────────────────────────
  // Idempotent. Sets `hydrated = true` BEFORE reading, so any synchronous
  // re-entry from emit() is a no-op rather than a recursive load.
  const hydrate = () => {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;

    let next: T | null = null;
    try {
      const raw = window.localStorage.getItem(opts.storageKey);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        next = parse(parsed);
      }
    } catch {
      // Corrupt blob — fall through to seed.
    }

    if (next !== null && next !== state) {
      state = next;
      emit();
    }
  };

  // ─── Cross-tab sync ────────────────────────────────────────────────────
  // The `storage` event fires only in OTHER tabs, so this never loops with
  // our own writes. Register once per store, no cleanup needed (modules are
  // long-lived in an SPA).
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== opts.storageKey) return;
      if (e.newValue === null) return;
      try {
        const parsed: unknown = JSON.parse(e.newValue);
        const next = parse(parsed);
        if (next !== null && next !== state) {
          state = next;
          emit();
        }
      } catch {
        // Ignore malformed payloads from the other tab.
      }
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────
  const subscribe = (cb: () => void) => {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  };

  const getSnapshot = () => state;
  // Always returns the same `opts.seed` reference passed in by the caller.
  // This is the line that React relies on to avoid the infinite-loop trap.
  const getServerSnapshot = () => opts.seed;

  const setState = (updater: T | ((current: T) => T)) => {
    const next =
      typeof updater === "function"
        ? (updater as (current: T) => T)(state)
        : updater;
    if (Object.is(next, state)) return; // No-op: nothing changed.
    state = next;
    persist();
    emit();
  };

  return {
    subscribe,
    getSnapshot,
    getServerSnapshot,
    getState: () => state,
    setState,
    hydrate,
    isHydrated: () => hydrated,
  };
}

/**
 * React glue. Triggers `hydrate()` on first mount (idempotent), then
 * subscribes via `useSyncExternalStore`. The three callbacks passed to
 * `useSyncExternalStore` are stable references on the store object — they
 * must NOT be wrapped in `useCallback` or recreated, or React will
 * resubscribe on every render.
 */
export function usePersistentStore<T>(store: PersistentStore<T>): T {
  React.useEffect(() => {
    store.hydrate();
  }, [store]);

  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
