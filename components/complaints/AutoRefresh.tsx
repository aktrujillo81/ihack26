"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LIST_REFRESH_SECONDS } from "@/lib/config/ui";

/**
 * Starts a timer that calls `refresh` every `intervalMs` while `isVisible()` is
 * true, and once more when the tab becomes visible again. Returns a stop
 * function. Pure and injectable so it is unit-tested without a browser.
 */
export function startAutoRefresh(options: {
  refresh: () => void;
  intervalMs: number;
  isVisible: () => boolean;
  onVisibilityChange: (listener: () => void) => () => void;
}): () => void {
  const tick = () => {
    if (options.isVisible()) options.refresh();
  };
  const timer = setInterval(tick, options.intervalMs);
  const stopListening = options.onVisibilityChange(tick);
  return () => {
    clearInterval(timer);
    stopListening();
  };
}

/**
 * D7, smallest version: the page re-reads its server data by itself. It renders
 * nothing and calls no endpoint: `router.refresh()` re-runs the server
 * components, which apply the session's scope as usual. Paused while the tab is
 * hidden. See docs/contracts.md 6.7 for the larger `/api/live` design.
 */
export function AutoRefresh({ seconds = LIST_REFRESH_SECONDS }: { seconds?: number }) {
  const router = useRouter();
  useEffect(
    () =>
      startAutoRefresh({
        refresh: () => router.refresh(),
        intervalMs: seconds * 1000,
        isVisible: () => document.visibilityState === "visible",
        onVisibilityChange: (listener) => {
          document.addEventListener("visibilitychange", listener);
          return () => document.removeEventListener("visibilitychange", listener);
        },
      }),
    [router, seconds],
  );
  return null;
}
