import { describe, expect, it } from "vitest";

import { DEFAULT_TEXT_MAX_LENGTH } from "@/lib/config/intake-defaults";
import { capFreeText, capText, capTextOrNull, resolveTextCaps } from "@/lib/ingest/text-caps";

describe("capText", () => {
  it("keeps short text and trims it", () => {
    expect(capText("  Riverside Village  ", 300)).toBe("Riverside Village");
  });

  it("keeps text exactly at the cap and cuts one over", () => {
    expect(capText("a".repeat(50), 50)).toBe("a".repeat(50));
    expect(capText("a".repeat(51), 50)).toBe("a".repeat(50));
  });

  it("removes trailing space left by the cut", () => {
    expect(capText("abc def", 4)).toBe("abc");
  });

  it("counts code points and never splits a surrogate pair", () => {
    const text = "\u{1F4A7}".repeat(10);
    const out = capText(text, 4);
    expect(Array.from(out)).toHaveLength(4);
    expect(out).toBe("\u{1F4A7}".repeat(4));
  });

  it("returns an empty string for blank input", () => {
    expect(capText("   ", 10)).toBe("");
  });

  it("keeps the number marker whole when it fits", () => {
    expect(capText("call [number removed]", 300)).toBe("call [number removed]");
  });
});

describe("capTextOrNull", () => {
  it("keeps null as null and caps a string", () => {
    expect(capTextOrNull(null, 5)).toBeNull();
    expect(capTextOrNull("abcdefgh", 5)).toBe("abcde");
  });
});

describe("resolveTextCaps", () => {
  it("uses the defaults from the contract when the row is missing", () => {
    expect(resolveTextCaps(undefined)).toEqual({ location: 300, summary: 500, language: 50 });
    expect(resolveTextCaps(null)).toEqual(DEFAULT_TEXT_MAX_LENGTH);
  });

  it("reads valid values from the row", () => {
    expect(resolveTextCaps({ location: 100, summary: 200, language: 10 })).toEqual({
      location: 100,
      summary: 200,
      language: 10,
    });
  });

  it("falls back per key and never throws on bad values", () => {
    const bad = { location: "300", summary: -1, language: 1.5 };
    expect(resolveTextCaps(bad)).toEqual(DEFAULT_TEXT_MAX_LENGTH);
    expect(resolveTextCaps({ location: 0, summary: 40 })).toEqual({ location: 300, summary: 40, language: 50 });
    expect(resolveTextCaps("text")).toEqual(DEFAULT_TEXT_MAX_LENGTH);
    expect(resolveTextCaps([1, 2])).toEqual(DEFAULT_TEXT_MAX_LENGTH);
  });
});

describe("capFreeText", () => {
  it("caps location, summary and language with their own limits", () => {
    const out = capFreeText({
      locationText: "l".repeat(400),
      summary: "s".repeat(600),
      languageSpoken: "g".repeat(80),
    });
    expect(out.locationText).toHaveLength(300);
    expect(out.summary).toHaveLength(500);
    expect(out.languageSpoken).toHaveLength(50);
  });

  it("keeps a null language null and the text unknown unchanged", () => {
    expect(capFreeText({ locationText: "unknown", summary: "", languageSpoken: null })).toEqual({
      locationText: "unknown",
      summary: "",
      languageSpoken: null,
    });
  });

  it("uses caps passed in", () => {
    const out = capFreeText(
      { locationText: "abcdefghij", summary: "abcdefghij", languageSpoken: "abcdefghij" },
      { location: 3, summary: 4, language: 5 },
    );
    expect(out).toEqual({ locationText: "abc", summary: "abcd", languageSpoken: "abcde" });
  });
});
