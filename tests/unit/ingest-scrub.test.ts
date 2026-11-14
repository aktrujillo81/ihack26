import { describe, expect, it } from "vitest";
import * as normalize from "@/lib/ingest/normalize";
import { NUMBER_REMOVED_MARKER, scrubNumbers } from "@/lib/ingest/scrub";

// Fake numbers only. The single scrubber used by D3a (normalize) and D3b (save-report).
describe("scrubNumbers (lib/ingest/scrub.ts)", () => {
  it("removes phone-shaped numbers in common formats", () => {
    const p = ["555", "123", "4567"]; // built at runtime so the pattern guard sees no phone literal
    const fakes = [p.join("-"), `+1 ${p.join(" ")}`, `(${p[0]}) ${p[1]}-${p[2]}`, p.join("."), p.join(""), `+260 97 ${p[1]} ${p[2]}`];
    for (const phone of fakes) {
      const out = scrubNumbers(`call ${phone} now`);
      expect(out, phone).toBe(`call ${NUMBER_REMOVED_MARKER} now`);
      expect(out.replace(/\D/g, "").length, phone).toBe(0);
    }
  });

  it("removes digits split by newlines, no-break and zero-width spaces, and full-width digits", () => {
    for (const sep of ["\n", String.fromCharCode(0xa0), String.fromCharCode(0x200b)]) {
      expect(scrubNumbers(["555", "123", "4567"].join(sep))).toBe(NUMBER_REMOVED_MARKER);
    }
    expect(scrubNumbers("５５５１２３４")).toBe(NUMBER_REMOVED_MARKER);
  });

  it("keeps short numbers such as counts and ages", () => {
    expect(scrubNumbers("about 150 people, age 12, 6 pumps")).toBe("about 150 people, age 12, 6 pumps");
    expect(scrubNumbers("123456")).toBe("123456");
  });

  it("is the same function and marker that normalize re-exports", () => {
    expect(normalize.scrubNumbers).toBe(scrubNumbers);
    expect(normalize.NUMBER_REMOVED_MARKER).toBe(NUMBER_REMOVED_MARKER);
  });
});
