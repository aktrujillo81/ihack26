import { describe, expect, it } from "vitest";
import { historyText } from "@/components/complaints/format";
import type { HistoryEvent } from "@/lib/domain/types";

const event = (over: Partial<HistoryEvent>): HistoryEvent =>
  ({ id: "h", complaintId: "c", waterPointId: "w", type: "passed_on", actor: null, before: { status: "open" }, after: { status: "passed_on" }, note: null, at: "2026-11-13T09:00:00Z", ...over }) as HistoryEvent;

describe("historyText", () => {
  it("passed_on says only that it was passed on, from codes", () => {
    expect(historyText(event({}))).toBe("Passed on");
  });
  it("passed_on never shows free text, even if an old row still holds some", () => {
    expect(historyText(event({ after: { status: "passed_on", passedOnNote: "Typed Co-op" } }))).not.toContain("Typed Co-op");
  });
  it("status_changed reads the status codes", () => {
    expect(historyText(event({ type: "status_changed", before: { status: "open" }, after: { status: "fixed" } }))).toMatch(/Open.*Fixed/i);
  });
  it("an unknown event type is shown generically", () => {
    expect(historyText(event({ type: "something_new" as never }))).toBe("Change recorded");
  });
});
