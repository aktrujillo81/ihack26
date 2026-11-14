import { describe, expect, it } from "vitest";

import { WATER_POINT_TYPES } from "@/lib/domain/types";
import { WATER_POINT_TYPE_ALIASES, applyWaterPointTypeAlias } from "@/lib/ingest/aliases";

describe("water point type alias map", () => {
  it("maps handpump to hand_pump", () => {
    expect(applyWaterPointTypeAlias("handpump")).toBe("hand_pump");
  });

  it("leaves canonical values and other text unchanged", () => {
    for (const type of WATER_POINT_TYPES) expect(applyWaterPointTypeAlias(type)).toBe(type);
    expect(applyWaterPointTypeAlias("pump")).toBe("pump");
    expect(applyWaterPointTypeAlias("")).toBe("");
  });

  it("does not follow inherited object keys", () => {
    expect(applyWaterPointTypeAlias("constructor")).toBe("constructor");
    expect(applyWaterPointTypeAlias("__proto__")).toBe("__proto__");
    expect(applyWaterPointTypeAlias("toString")).toBe("toString");
  });

  it("only points at allowed types, and is frozen", () => {
    for (const target of Object.values(WATER_POINT_TYPE_ALIASES)) expect(WATER_POINT_TYPES).toContain(target);
    expect(Object.isFrozen(WATER_POINT_TYPE_ALIASES)).toBe(true);
  });
});
