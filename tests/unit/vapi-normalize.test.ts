import { describe, expect, it } from "vitest";

import { INTAKE_TEXT_MAX_LENGTH } from "@/lib/config/intake";
import { normalizeEndedReason, normalizeMessage, scrubNumbers } from "@/lib/ingest/normalize";

const SCOPE = { organizationId: "org-1", regionId: "region-1" };

function good(overrides: Record<string, unknown> = {}) {
  return {
    location_text: "Riverside Village near the market",
    water_point_type: "hand_pump",
    problem: "no_water",
    people_affected: "150",
    serves_school_or_clinic: "true",
    duration: "week_or_more",
    caller_confirmed: true,
    summary: "The hand pump has no water.",
    language_spoken: "English",
    ...overrides,
  };
}

const run = (overrides: Record<string, unknown> = {}, remove: string[] = []) => {
  const result = good(overrides) as Record<string, unknown>;
  for (const k of remove) delete result[k];
  return normalizeMessage(
    { type: "end-of-call-report", endedReason: "customer-ended-call", artifact: { structuredOutputs: { x: { name: "water_point_report", result } } } },
    SCOPE,
  );
};

describe("enum values and aliases (contracts 5.1)", () => {
  it("trims, lowercases, and maps spaces and hyphens to underscores", () => {
    expect(run({ water_point_type: "  Hand pump " }).waterPointType).toBe("hand_pump");
    expect(run({ duration: "Week-or-more" }).duration).toBe("week_or_more");
    expect(run({ problem: "NO WATER" }).problem).toBe("no_water");
  });

  it("maps the two aliases and nothing else", () => {
    expect(run({ water_point_type: "handpump" }).waterPointType).toBe("hand_pump");
    expect(run({ water_point_type: "Bore hole" }).waterPointType).toBe("borehole");
    expect(run({ water_point_type: "bore-hole" }).waterPointType).toBe("borehole");
    const r = run({ water_point_type: "hand pumps" });
    expect(r.waterPointType).toBe("unknown");
    expect(r.needsReviewReason).toBe("invalid_fields");
  });

  it("the aliases apply to the type field only", () => {
    expect(run({ problem: "handpump" }).needsReviewReason).toBe("invalid_fields");
  });

  it("every allowed value passes without a review reason", () => {
    for (const t of ["well", "hand_pump", "tap", "borehole", "other", "unknown"]) expect(run({ water_point_type: t }).waterPointType).toBe(t);
    for (const p of ["no_water", "broken", "dirty", "slow", "other", "unknown"]) expect(run({ problem: p }).problem).toBe(p);
    for (const d of ["today", "few_days", "week_or_more", "unknown"]) expect(run({ duration: d }).duration).toBe(d);
  });

  it("a caller's own unknown is valid and sets no reason", () => {
    const r = run({ water_point_type: "unknown", problem: "unknown", duration: "unknown", people_affected: "unknown", serves_school_or_clinic: "unknown" });
    expect(r.needsReview).toBe(false);
    expect(r.needsReviewReason).toBeNull();
    expect(r.peopleAffected).toBeNull();
    expect(r.servesSchoolOrClinic).toBeNull();
  });

  it("an outside value or a missing field is unknown plus invalid_fields; never silently null", () => {
    for (const [k, v] of [["water_point_type", "spring"], ["problem", 5], ["duration", "yesterday"], ["problem", ""]] as const) {
      const r = run({ [k]: v });
      expect(r.needsReviewReason, k).toBe("invalid_fields");
      expect(r.needsReview).toBe(true);
    }
    for (const k of ["water_point_type", "problem", "duration"]) {
      expect(run({}, [k]).needsReviewReason, k).toBe("invalid_fields");
    }
  });
});

describe("numbers and booleans", () => {
  it("people_affected: digits, numbers, unknown, bad", () => {
    expect(run({ people_affected: " 42 " }).peopleAffected).toBe(42);
    expect(run({ people_affected: 42 }).peopleAffected).toBe(42);
    expect(run({ people_affected: "9999999" }).peopleAffected).toBe(9_999_999);
    for (const bad of ["12345678", "about 40", "-3", "4.5", 4.5, -1, true, ""]) {
      const r = run({ people_affected: bad });
      expect(r.peopleAffected, String(bad)).toBeNull();
      expect(r.needsReviewReason, String(bad)).toBe("invalid_fields");
    }
    expect(run({}, ["people_affected"]).peopleAffected).toBeNull();
  });

  it("serves_school_or_clinic: true/false strings and booleans, unknown null, other invalid", () => {
    expect(run({ serves_school_or_clinic: "true" }).servesSchoolOrClinic).toBe(true);
    expect(run({ serves_school_or_clinic: true }).servesSchoolOrClinic).toBe(true);
    expect(run({ serves_school_or_clinic: "False" }).servesSchoolOrClinic).toBe(false);
    expect(run({ serves_school_or_clinic: false }).servesSchoolOrClinic).toBe(false);
    for (const bad of ["yes", "no", 1, null]) {
      const r = run({ serves_school_or_clinic: bad });
      expect(r.servesSchoolOrClinic).toBeNull();
      expect(r.needsReviewReason).toBe("invalid_fields");
    }
  });

  it("caller_confirmed: a boolean, else null (never false), and null or false means not_confirmed", () => {
    expect(run({ caller_confirmed: true }).callerConfirmed).toBe(true);
    const f = run({ caller_confirmed: false });
    expect(f.callerConfirmed).toBe(false);
    expect(f.needsReviewReason).toBe("not_confirmed");
    for (const v of ["true", 1, null]) {
      const r = run({ caller_confirmed: v });
      expect(r.callerConfirmed).toBeNull();
      expect(r.needsReviewReason).toBe("not_confirmed");
    }
    expect(run({}, ["caller_confirmed"]).callerConfirmed).toBeNull();
  });
});

describe("reason priority (contracts 5.2)", () => {
  it("unusable_location beats invalid_fields beats not_confirmed", () => {
    expect(run({ location_text: "", problem: "x", caller_confirmed: false }).needsReviewReason).toBe("unusable_location");
    expect(run({ problem: "x", caller_confirmed: false }).needsReviewReason).toBe("invalid_fields");
    expect(run({ caller_confirmed: false }).needsReviewReason).toBe("not_confirmed");
  });

  it("an unusable location is stored as the text unknown", () => {
    for (const loc of [undefined, "", "  ", "unknown", "UNKNOWN", "ab", 12, "0123456789", "[number removed]"]) {
      const r = run({ location_text: loc });
      expect(r.locationText, String(loc)).toBe("unknown");
      expect(r.needsReviewReason, String(loc)).toBe("unusable_location");
    }
    expect(run({ location_text: "Oyo" }).needsReviewReason).toBeNull();
  });

  it("needsReview is true exactly when the reason is set", () => {
    for (const r of [run(), run({ caller_confirmed: false }), run({ location_text: "" })]) {
      expect(r.needsReview).toBe(r.needsReviewReason !== null);
    }
  });
});

describe("number scrub and caps", () => {
  it("replaces runs of 7 or more digits in any common format, keeps short numbers", () => {
    const phoneParts = ["555", "123", "4567"];
    for (const phone of [phoneParts.join(""), phoneParts.join(" "), `+1 (${phoneParts[0]}) ${phoneParts[1]}-${phoneParts[2]}`, phoneParts.join("."), "555-1234", ["0", "7", "1", "2", "3", "4", "5"].join(" "), `[${phoneParts[0]}] ${phoneParts[1]} ${phoneParts[2]}`]) {
      expect(scrubNumbers(`call ${phone} now`), phone).toBe("call [number removed] now");
    }
    expect(scrubNumbers("about 150 people, age 12, 6 pumps")).toBe("about 150 people, age 12, 6 pumps");
    expect(scrubNumbers("123456")).toBe("123456");
  });

  it("catches digits split by newlines, non-breaking spaces and zero-width spaces", () => {
    expect(scrubNumbers(["555", "123", "4567"].join("\n"))).toBe("[number removed]");
    expect(scrubNumbers(["555", "123", "4567"].join(String.fromCharCode(0xa0)))).toBe("[number removed]");
    expect(scrubNumbers(["555", "123", "4567"].join(String.fromCharCode(0x200b)))).toBe("[number removed]");
    expect(scrubNumbers("5\r\n5\r\n5\r\n1\r\n2\r\n3\r\n4")).toBe("[number removed]");
    expect(scrubNumbers("５５５１２３４")).toBe("[number removed]"); // full-width digits
  });

  it("scrubs location, summary and language", () => {
    const r = run({ location_text: `Near ${["555", "123", "4567"].join("")} market`, summary: `Call me on +44 ${["7700", "900", "123"].join(" ")} please`, language_spoken: ["555", "123", "4567"].join("") });
    expect(JSON.stringify(r)).not.toMatch(/\d{7}/);
    expect(r.locationText).toContain("[number removed]");
    expect(r.summary).toContain("[number removed]");
    expect(r.languageSpoken).toBe("[number removed]");
  });

  it("caps text after scrubbing, to the configured lengths", () => {
    const r = run({
      location_text: "L".repeat(1000),
      summary: "S".repeat(1000),
      language_spoken: "G".repeat(1000),
    });
    expect(r.locationText).toHaveLength(INTAKE_TEXT_MAX_LENGTH.location);
    expect(r.summary).toHaveLength(INTAKE_TEXT_MAX_LENGTH.summary);
    expect(r.languageSpoken).toHaveLength(INTAKE_TEXT_MAX_LENGTH.language);
    // A long number near the cap is scrubbed first, so no digit survives the cut.
    const near = run({ summary: `${"a".repeat(INTAKE_TEXT_MAX_LENGTH.summary - 5)}${["555", "1234567890"].join("")}` });
    expect(near.summary).not.toMatch(/\d{3}/);
    expect(near.summary!.length).toBeLessThanOrEqual(INTAKE_TEXT_MAX_LENGTH.summary);
  });

  it("empty summary and language are null; non-text is null", () => {
    expect(run({ summary: "  ", language_spoken: 5 }).summary).toBeNull();
    expect(run({ summary: "  ", language_spoken: 5 }).languageSpoken).toBeNull();
  });
});

describe("ended reason and allowlist", () => {
  it("known values stay, unknown strings are other, none is null", () => {
    expect(normalizeEndedReason("customer-ended-call")).toBe("customer-ended-call");
    expect(normalizeEndedReason("assistant-said-end-call-phrase")).toBe("assistant-said-end-call-phrase");
    expect(normalizeEndedReason("silence-timed-out")).toBe("other");
    expect(normalizeEndedReason("")).toBeNull();
    expect(normalizeEndedReason(undefined)).toBeNull();
    expect(normalizeEndedReason(7)).toBeNull();
  });

  it("copies nothing outside the allowlist (no transcript, no number, no other field)", () => {
    const message = {
      type: "end-of-call-report",
      transcript: "TRANSCRIPT-SENTINEL",
      customer: { number: `+1${["555", "123", "4567"].join("")}` },
      call: { customer: { number: `+1${["555", "123", "4567"].join("")}` } },
      artifact: {
        transcript: "TRANSCRIPT-SENTINEL",
        structuredOutputs: { x: { name: "water_point_report", result: { ...good(), caller_name: "NAME-SENTINEL", extra: { a: 1 } } } },
      },
    };
    const r = normalizeMessage(message, SCOPE);
    const text = JSON.stringify(r);
    expect(text).not.toContain("SENTINEL");
    expect(text).not.toContain(["555", "123", "4567"].join(""));
    expect(Object.keys(r).sort()).toEqual(
      ["callerConfirmed", "channel", "duration", "endedReason", "languageSpoken", "locationText", "needsReview", "needsReviewReason", "organizationId", "peopleAffected", "problem", "regionId", "servesSchoolOrClinic", "summary", "transcript", "waterPointType"],
    );
    expect(r.transcript).toBeNull();
  });
});
