import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MapLegend } from "@/components/map/MapLegend";
import { MapView } from "@/components/map/MapView";
import { PinList } from "@/components/map/PinList";
import { buildPins, type MapPin } from "@/components/map/pins";
import { MOCK_CONTEXT, listComplaints, listWaterPoints } from "@/lib/data/complaints";
import { mockComplaints, mockWaterPoints } from "@/lib/domain/mock";
import { t } from "@/lib/i18n/strings";

const pins = buildPins(mockWaterPoints, mockComplaints, "authenticated");
const pinFor = (id: string): MapPin => {
  const pin = pins.find((p) => p.id === id);
  if (!pin) throw new Error(`no pin for ${id}`);
  return pin;
};

describe("buildPins", () => {
  it("makes pins only for water points with coordinates", () => {
    expect(pins.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))).toBe(true);
    expect(pins.find((p) => p.id === "wp-5")).toBeUndefined(); // needs location
    expect(pins.find((p) => p.id === "wp-6")).toBeUndefined(); // needs location
  });

  it("open no_water or broken is a red circle labelled Open", () => {
    expect(pinFor("wp-1")).toMatchObject({ shape: "circle", color: "red", statusKey: "status.open" });
    expect(pinFor("wp-2")).toMatchObject({ shape: "circle", color: "red", statusKey: "status.open" });
  });

  it("passed on with a slow problem is a yellow diamond labelled Passed on", () => {
    expect(pinFor("wp-3")).toMatchObject({ shape: "diamond", color: "yellow", statusKey: "status.passed_on" });
  });

  it("fixed is a green check and no complaint is a green square", () => {
    expect(pinFor("wp-4")).toMatchObject({ shape: "check", color: "green", statusKey: "status.fixed" });
    expect(pinFor("wp-7")).toMatchObject({ shape: "square", color: "green", statusKey: "map.noOpenComplaint" });
  });

  it("an unknown problem is yellow, never red", () => {
    const wp = { ...mockWaterPoints[0], id: "wp-x", latitude: 1, longitude: 2 };
    const c = { ...mockComplaints[0], id: "c-x", waterPointId: "wp-x", status: "open" as const, problem: "unknown" as const };
    expect(buildPins([wp], [c], "authenticated")[0]).toMatchObject({ color: "yellow", shape: "circle" });
  });

  it("uses the most urgent active complaint when a water point has several", () => {
    // wp-2 has c-2 (score 5) and c-7 (score 1): the pin follows c-2 and reports its count.
    expect(pinFor("wp-2")).toMatchObject({ complaintId: "c-2", reportCount: 1, color: "red" });
  });

  it("every pin has a shape, a label key and a color", () => {
    for (const p of pins) {
      expect(p.shape).toBeTruthy();
      expect(p.statusKey).toBeTruthy();
      expect(p.color).toBeTruthy();
    }
  });

  it("the public view carries status and report count only", () => {
    const publicPins = buildPins(mockWaterPoints, mockComplaints, "public");
    expect(publicPins.length).toBe(pins.length);
    for (const p of publicPins) {
      expect(p.complaintId).toBeNull();
      expect(p.locationText).toBeNull();
    }
  });

  it("pins carry no phone, email, contact or transcript fields", () => {
    const keys = Object.keys(pins[0]).join(" ").toLowerCase();
    expect(keys).not.toMatch(/phone|email|contact|transcript|caller/);
  });
});

describe("rendering", () => {
  it("the text list shows each pin's label, not only color", () => {
    const html = renderToStaticMarkup(createElement(PinList, { pins }));
    expect(html).toContain(t("status.open"));
    expect(html).toContain(t("status.passed_on"));
    expect(html).toContain(t("status.fixed"));
    expect(html).toContain(t("map.noOpenComplaint"));
    expect(html).toContain(t("map.reports", { n: 1 }));
  });

  it("the legend names every shape", () => {
    const html = renderToStaticMarkup(createElement(MapLegend));
    for (const key of ["status.open", "status.passed_on", "status.fixed", "map.noOpenComplaint", "common.unverified"] as const) {
      expect(html).toContain(t(key));
    }
  });

  it("nothing in the markup is hover-only", () => {
    const html = renderToStaticMarkup(createElement(PinList, { pins })) + renderToStaticMarkup(createElement(MapLegend));
    expect(html).not.toMatch(/title=|onmouseover|:hover/i);
  });

  it("MapView renders the map, legend and list for an in-scope user", async () => {
    const html = renderToStaticMarkup(await MapView({ ctx: MOCK_CONTEXT }));
    expect(html).toContain(t("map.legend"));
    expect(html).toContain(t("map.listTitle"));
    expect(html).toContain(t("map.needsLocationCount", { n: 2 }));
    expect(html).toContain("ww-map");
  });

  it("MapView shows the empty message for a user with no data in scope", async () => {
    const html = renderToStaticMarkup(await MapView({ ctx: { organizationId: "org-other", regionIds: ["region-demo"] } }));
    expect(html).toContain(t("map.empty"));
    expect(html).not.toContain("ww-map");
  });

  it("only draws what the data layer returns for the user's scope", async () => {
    const ctx = { organizationId: "org-other", regionIds: ["region-demo"] };
    expect((await listWaterPoints(ctx)).status).toBe("empty");
    expect((await listComplaints(ctx)).status).toBe("empty");
  });
});
