import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startAutoRefresh } from "@/components/complaints/AutoRefresh";
import { LIST_REFRESH_SECONDS } from "@/lib/config/ui";

describe("startAutoRefresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(initiallyVisible = true) {
    let visible = initiallyVisible;
    let listener: (() => void) | null = null;
    const refresh = vi.fn();
    const stopListening = vi.fn(() => { listener = null; });
    const stop = startAutoRefresh({
      refresh,
      intervalMs: LIST_REFRESH_SECONDS * 1000,
      isVisible: () => visible,
      onVisibilityChange: (l) => { listener = l; return stopListening; },
    });
    return { refresh, stop, stopListening, setVisible: (v: boolean) => { visible = v; }, fire: () => listener?.() };
  }

  it("refreshes every 15 seconds while the tab is visible", () => {
    expect(LIST_REFRESH_SECONDS).toBe(15);
    const t = setup();
    vi.advanceTimersByTime(14_999);
    expect(t.refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(t.refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    expect(t.refresh).toHaveBeenCalledTimes(3);
    t.stop();
  });

  it("does not refresh while the tab is hidden, and refreshes once when it becomes visible", () => {
    const t = setup();
    t.setVisible(false);
    vi.advanceTimersByTime(60_000);
    t.fire();
    expect(t.refresh).not.toHaveBeenCalled();
    t.setVisible(true);
    t.fire();
    expect(t.refresh).toHaveBeenCalledTimes(1);
    t.stop();
  });

  it("stop clears the timer and the listener", () => {
    const t = setup();
    t.stop();
    vi.advanceTimersByTime(60_000);
    expect(t.refresh).not.toHaveBeenCalled();
    expect(t.stopListening).toHaveBeenCalledTimes(1);
  });
});
