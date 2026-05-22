"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StorageKind = "localStorage" | "sessionStorage";

type StoredPageState<T> = {
  version: number;
  updatedAt: string;
  state: T;
};

type PersistentPageStateOptions<T> = {
  scope?: string;
  userKey?: string | null;
  version: number;
  initialState: T;
  debounceMs?: number;
  storage?: StorageKind;
  persistInitialState?: boolean;
};

function keyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9:_./-]/g, "_");
}

function getBrowserStorage(kind: StorageKind) {
  if (typeof window === "undefined") {
    return null;
  }

  return kind === "sessionStorage" ? window.sessionStorage : window.localStorage;
}

function stableStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function usePersistentPageState<T>({
  scope,
  userKey,
  version,
  initialState,
  debounceMs = 250,
  storage = "localStorage",
  persistInitialState = false
}: PersistentPageStateOptions<T>) {
  const pathname = usePathname();
  const initialStateRef = useRef(initialState);
  const initialStateStringRef = useRef(stableStringify(initialState));
  const clearedStateStringRef = useRef<string | null>(null);
  const [state, setState] = useState<T>(initialStateRef.current);
  const [restored, setRestored] = useState(false);
  const storageKey = useMemo(() => {
    const routeScope = scope ?? pathname ?? "unknown-route";
    const accountScope = userKey ? keyPart(userKey) : "anonymous";

    return `fopos:page-state:${accountScope}:${keyPart(routeScope)}`;
  }, [pathname, scope, userKey]);

  useEffect(() => {
    const targetStorage = getBrowserStorage(storage);

    if (!targetStorage) {
      setRestored(true);
      return;
    }

    try {
      const raw = targetStorage.getItem(storageKey);

      if (!raw) {
        setRestored(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<StoredPageState<T>>;

      if (parsed.version !== version || !("state" in parsed)) {
        targetStorage.removeItem(storageKey);
        setRestored(true);
        return;
      }

      setState(parsed.state as T);
    } catch {
      targetStorage.removeItem(storageKey);
    } finally {
      setRestored(true);
    }
  }, [storage, storageKey, version]);

  useEffect(() => {
    if (!restored) {
      return;
    }

    const targetStorage = getBrowserStorage(storage);

    if (!targetStorage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        const serializedState = stableStringify(state);

        if (clearedStateStringRef.current === serializedState) {
          targetStorage.removeItem(storageKey);
          return;
        }

        clearedStateStringRef.current = null;

        if (!persistInitialState && serializedState === initialStateStringRef.current) {
          targetStorage.removeItem(storageKey);
          return;
        }

        const payload: StoredPageState<T> = {
          version,
          updatedAt: new Date().toISOString(),
          state
        };

        targetStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // localStorage can be unavailable or full; page state persistence should not block work.
      }
    }, debounceMs);

    return () => window.clearTimeout(timeout);
  }, [debounceMs, persistInitialState, restored, state, storage, storageKey, version]);

  const clear = useCallback(
    (nextState?: T) => {
      const targetStorage = getBrowserStorage(storage);

      try {
        targetStorage?.removeItem(storageKey);
      } catch {
        // Ignore storage failures; the in-memory state still resets.
      }

      const resolvedState = nextState ?? initialStateRef.current;
      clearedStateStringRef.current = stableStringify(resolvedState);
      setState(resolvedState);
    },
    [storage, storageKey]
  );

  const meta = useMemo(
    () => ({
      clear,
      restored,
      storageKey
    }),
    [clear, restored, storageKey]
  );

  return [state, setState, meta] as const;
}
