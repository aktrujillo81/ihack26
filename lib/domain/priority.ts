import { PRIORITY_HIGH_FROM_SCORE, PRIORITY_MEDIUM_FROM_SCORE } from "@/lib/config/ui";

export type PriorityLevel = "high" | "medium" | "low";

/**
 * The ONE place a priority score becomes High, Medium or Low. Every screen uses
 * this; do not repeat the cutoffs. PROVISIONAL: the cutoffs are proposed in
 * lib/config/ui.ts and need the team's confirmation. A score that is not a
 * finite number reads as Low, never as an error.
 */
export function priorityLevel(score: number): PriorityLevel {
  if (!Number.isFinite(score)) return "low";
  if (score >= PRIORITY_HIGH_FROM_SCORE) return "high";
  if (score >= PRIORITY_MEDIUM_FROM_SCORE) return "medium";
  return "low";
}
