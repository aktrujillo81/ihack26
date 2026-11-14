import { describe, expect, it } from "vitest";

import { PRIORITY_HIGH_FROM_SCORE, PRIORITY_MEDIUM_FROM_SCORE } from "@/lib/config/ui";
import { priorityLevel } from "@/lib/domain/priority";

describe("priorityLevel (PROVISIONAL cutoffs, one shared function)", () => {
  it("covers the whole range the spec's weights can produce (about 1 to 13), in order", () => {
    const levels = Array.from({ length: 14 }, (_, score) => priorityLevel(score));
    expect(levels).toEqual(["low", "low", "low", "low", "medium", "medium", "medium", "high", "high", "high", "high", "high", "high", "high"]);
  });

  it("the cutoffs are the configured ones, and High is above Medium", () => {
    expect(PRIORITY_HIGH_FROM_SCORE).toBeGreaterThan(PRIORITY_MEDIUM_FROM_SCORE);
    expect(priorityLevel(PRIORITY_HIGH_FROM_SCORE)).toBe("high");
    expect(priorityLevel(PRIORITY_HIGH_FROM_SCORE - 1)).toBe("medium");
    expect(priorityLevel(PRIORITY_MEDIUM_FROM_SCORE)).toBe("medium");
    expect(priorityLevel(PRIORITY_MEDIUM_FROM_SCORE - 1)).toBe("low");
  });

  it("the demo scores read sensibly: a school with no water is High, a lone unknown problem is Low", () => {
    expect(priorityLevel(12)).toBe("high");
    expect(priorityLevel(7)).toBe("high");
    expect(priorityLevel(5)).toBe("medium");
    expect(priorityLevel(2)).toBe("low");
    expect(priorityLevel(1)).toBe("low");
  });

  it("anything that is not a finite number reads as Low, never an error", () => {
    for (const score of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -3, 0]) expect(priorityLevel(score), String(score)).toBe("low");
  });
});
