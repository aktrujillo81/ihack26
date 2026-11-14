import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PUBLIC as PUBLIC_LEGEND } from "@/components/map/MapLegend";
import { PinMarker, pinLabelLines } from "@/components/map/PinMarker";
import { PublicMapView } from "@/components/map/PublicMapView";
import { toPublicMapPins } from "@/components/map/publicPins";
import { publicMapScope } from "@/lib/config/public-map";
import { PUBLIC_PIN_KEYS, listPublicWaterPoints, type PublicPin, type PublicScope } from "@/lib/data/complaints";
import { mockComplaints, mockNotes, mockReports, mockWaterPoints } from "@/lib/domain/mock";
import { WATER_POINT_TYPES } from "@/lib/domain/types";
import { t } from "@/lib/i18n/strings";

const SCOPE: PublicScope = { organizationId: "org-demo", regionIds: ["region-demo"] };

async function pins(scope: PublicScope | null = SCOPE): Promise<PublicPin[]> {
  const r = await listPublicWaterPoints(scope);
  if (r.status !== "ok") throw new Error(`expected data, got ${r.status}`);
  return r.data;
}

/** Everything a non-public record could carry, to prove none of it appears in the public output. */
function everythingNonPublic(): string[] {
  const values: string[] = [];
  for (const wp of mockWaterPoints) values.push(wp.locationText, wp.id, wp.organizationId, wp.regionId);
  for (const c of mockComplaints) values.push(c.id, c.scoreReason, c.passedOnPartnerId ?? "");
  for (const r of mockReports) values.push(r.id, r.summary, r.transcript ?? "", r.locationText, r.languageSpoken);
  for (const n of mockNotes) values.push(n.text, n.author);
  return values.filter((v) => v.length >= 4);
}

describe("the public read returns only the allowlisted fields", () => {
  it("every pin has exactly the public keys and no others", async () => {
    for (const pin of await pins()) expect(Object.keys(pin).sort()).toEqual([...PUBLIC_PIN_KEYS].sort());
  });

  it("FAILS if any non-public field appears: no detail value from any record is in the output", async () => {
    const out = JSON.stringify(await pins());
    for (const secret of everythingNonPublic()) expect(out, secret).not.toContain(secret);
  });

  it("FAILS if a field is added to the records: unknown extra fields on a water point or complaint never reach the public", async () => {
    const wp = mockWaterPoints[0] as unknown as Record<string, unknown>;
    const c = mockComplaints[0] as unknown as Record<string, unknown>;
    wp.secretNote = "SECRET-WP-VALUE";
    wp.callerName = "SECRET-CALLER-NAME";
    c.transcript = "SECRET-TRANSCRIPT";
    c.reporterCount = 4242;
    try {
      const out = JSON.stringify(await pins());
      for (const leaked of ["SECRET-WP-VALUE", "SECRET-CALLER-NAME", "SECRET-TRANSCRIPT", "4242", "secretNote", "callerName", "reporterCount"]) {
        expect(out, leaked).not.toContain(leaked);
      }
      for (const pin of await pins()) expect(Object.keys(pin).sort()).toEqual([...PUBLIC_PIN_KEYS].sort());
    } finally {
      delete wp.secretNote;
      delete wp.callerName;
      delete c.transcript;
      delete c.reporterCount;
    }
  });

  it("has no id, text location, count, problem, date, note or contact keys, at any depth", async () => {
    const forbidden = /(^id$|Id$|text|count|problem|people|school|duration|score|reason|note|transcript|summary|report|caller|phone|email|contact|name|region|organization|review|partner|date|At$)/i;
    for (const pin of await pins()) {
      for (const key of Object.keys(pin)) expect(key, key).not.toMatch(forbidden);
    }
  });

  it("the key is a position in this response, not an internal id", async () => {
    const out = await pins();
    expect(out.map((p) => p.key)).toEqual(out.map((_, i) => `pin-${i + 1}`));
    const internalIds = new Set([...mockWaterPoints.map((w) => w.id), ...mockComplaints.map((c) => c.id)]);
    for (const p of out) expect(internalIds.has(p.key)).toBe(false);
  });

  it("only active water points with coordinates in the public scope are returned", async () => {
    const out = await pins();
    // wp-1..4, wp-7, wp-8 have coordinates and are active; wp-5/6 have none; wp-9 merged; wp-10 archived.
    expect(out).toHaveLength(6);
  });

  it("statuses are derived from complaints without exposing any: open, passed_on, fixed, none", async () => {
    const statuses = (await pins()).map((p) => p.status).sort();
    expect(statuses).toEqual(["fixed", "none", "none", "open", "open", "passed_on"]);
  });

  it("unverified is the only extra flag", async () => {
    expect((await pins()).every((p) => typeof p.unverified === "boolean")).toBe(true);
  });
});

describe("the public scope fails closed", () => {
  it("no scope, an empty organization, or no regions returns empty, never everything", async () => {
    for (const scope of [null, { organizationId: "", regionIds: ["region-demo"] }, { organizationId: "org-demo", regionIds: [] }]) {
      const r = await listPublicWaterPoints(scope as PublicScope | null);
      expect(r.status, JSON.stringify(scope)).toBe("empty");
    }
  });

  it("another organization or region returns nothing", async () => {
    expect((await listPublicWaterPoints({ organizationId: "org-other", regionIds: ["region-demo"] })).status).toBe("empty");
    expect((await listPublicWaterPoints({ organizationId: "org-demo", regionIds: ["region-elsewhere"] })).status).toBe("empty");
  });

  it("the configured scope is off unless both settings are present", () => {
    expect(publicMapScope({})).toBeNull();
    expect(publicMapScope({ PUBLISHED_MAP_ORGANIZATION_ID: "org-demo" })).toBeNull();
    expect(publicMapScope({ PUBLISHED_MAP_REGION_IDS: "region-demo" })).toBeNull();
    expect(publicMapScope({ PUBLISHED_MAP_ORGANIZATION_ID: " ", PUBLISHED_MAP_REGION_IDS: "region-demo" })).toBeNull();
    expect(publicMapScope({ PUBLISHED_MAP_ORGANIZATION_ID: "org-demo", PUBLISHED_MAP_REGION_IDS: " , " })).toBeNull();
    expect(publicMapScope({ PUBLISHED_MAP_ORGANIZATION_ID: "org-demo", PUBLISHED_MAP_REGION_IDS: "a, b" })).toEqual({
      organizationId: "org-demo",
      regionIds: ["a", "b"],
    });
  });
});

describe("public map pins and page", () => {
  it("every pin has a shape, a text label with its status and its type, never color alone", async () => {
    const mapPins = toPublicMapPins(await pins());
    for (const p of mapPins) {
      expect(p.shape).toBeTruthy();
      expect(p.statusKey).toBeTruthy();
      expect(p.title).toMatch(/^type\./);
    }
    expect(new Set(mapPins.map((p) => p.shape)).size).toBe(4); // circle, diamond, check, square
  });

  it("color follows status only, so the problem is not revealed", async () => {
    const mapPins = toPublicMapPins(await pins());
    const byShape = (shape: string) => new Set(mapPins.filter((p) => p.shape === shape).map((p) => p.color));
    expect([...byShape("circle")]).toEqual(["red"]);
    expect([...byShape("diamond")]).toEqual(["yellow"]);
    expect([...byShape("check")]).toEqual(["green"]);
    expect([...byShape("square")]).toEqual(["green"]);
  });

  it("map pins carry no id, location text, problem, review flag, count or complaint link", async () => {
    for (const p of toPublicMapPins(await pins())) {
      expect(p).toMatchObject({ locationText: null, problem: null, needsReview: false, reportCount: 0, complaintId: null });
      expect(p.id).toMatch(/^pin-\d+$/);
    }
  });

  it("the rendered page contains status words and types but no detail, for any pin", async () => {
    const html = renderToStaticMarkup(await PublicMapView({ scope: SCOPE }));
    for (const word of [t("status.open"), t("status.passed_on"), t("status.fixed"), t("map.noOpenComplaint"), t("type.hand_pump"), t("map.legend"), t("map.listTitle")]) {
      expect(html).toContain(word);
    }
    for (const secret of everythingNonPublic()) expect(html, secret).not.toContain(secret.replace(/'/g, "&#x27;"));
    expect(html).not.toContain("Assistant:");
    expect(html).not.toMatch(/Reports: \d/);
    expect(html).not.toMatch(/Needs review|problem|No water|Broken|Slow|Dirty/i);
  });

  it("nothing is hover-only in the page markup", async () => {
    const html = renderToStaticMarkup(await PublicMapView({ scope: SCOPE }));
    expect(html).not.toMatch(/title=|onmouseover|:hover/i);
  });

  it("empty state: no scope or nothing in scope shows the empty message, not an error and not a map", async () => {
    for (const scope of [null, { organizationId: "org-other", regionIds: ["region-demo"] }]) {
      const html = renderToStaticMarkup(await PublicMapView({ scope }));
      expect(html).toContain(t("map.empty"));
      expect(html).not.toContain("ww-map");
      expect(html).not.toContain('role="alert"');
    }
  });

  it("error state shows the generic error and nothing else", async () => {
    // A scope whose region list throws when read forces the read to fail.
    const regionIds = Object.assign(["region-demo"], {
      includes() {
        throw new Error("boom");
      },
    });
    const html = renderToStaticMarkup(await PublicMapView({ scope: { organizationId: "org-demo", regionIds } }));
    expect(html).toContain("Something went wrong. Please try again.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("boom");
    expect(html).not.toContain("ww-map");
  });

  it("the page does not read a session or build a user", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["app/map/page.tsx", "components/map/PublicMapView.tsx", "components/map/publicPins.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/getCurrentSession|requireSession|MOCK_CONTEXT|auth\/session|auth\/guards|next\/headers|cookies\(/);
    }
  });
});

describe("hardening from the security review", () => {
  it("type and status are checked at runtime: a leak hidden inside an allowed field would fail", async () => {
    for (const pin of await pins()) {
      expect(WATER_POINT_TYPES as readonly string[]).toContain(pin.type);
      expect(["open", "passed_on", "fixed", "none"]).toContain(pin.status);
      expect(Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude)).toBe(true);
      expect(typeof pin.unverified).toBe("boolean");
    }
  });

  it("unverified points are not published by default, and only appear when explicitly turned on", async () => {
    const extra = {
      ...mockWaterPoints[0],
      id: "wp-unverified-test",
      latitude: -1.5,
      longitude: 36.9,
      verificationState: "unverified" as const,
    };
    mockWaterPoints.push(extra);
    try {
      const def = await listPublicWaterPoints(SCOPE);
      const on = await listPublicWaterPoints(SCOPE, { includeUnverified: true });
      if (def.status !== "ok" || on.status !== "ok") throw new Error("expected data");
      expect(def.data.some((p) => p.unverified)).toBe(false);
      expect(on.data.some((p) => p.unverified)).toBe(true);
      expect(on.data.length).toBe(def.data.length + 1);
    } finally {
      mockWaterPoints.pop();
    }
  });

  it("the order depends on public values only, not on internal ids", async () => {
    const out = await pins();
    const lat = out.map((p) => p.latitude);
    expect(lat).toEqual([...lat].sort((a, b) => a - b));
  });

  it("the marker HTML and the accessible label of every pin hold no detail", async () => {
    for (const pin of toPublicMapPins(await pins())) {
      const marker = renderToStaticMarkup(createElement(PinMarker, { pin }));
      const label = pinLabelLines(pin).join(". ");
      for (const secret of everythingNonPublic()) {
        expect(marker, secret).not.toContain(secret);
        expect(label, secret).not.toContain(secret);
      }
      expect(marker).not.toMatch(/Reports: \d|Needs review|No water|Broken|Slow|Dirty/);
      expect(label).toContain(t(pin.statusKey));
      expect(label).toContain(t(pin.title ?? "common.unknown"));
    }
  });

  it("the serialized pins sent to the browser carry only null or zero in the fields the public must not have", async () => {
    for (const pin of toPublicMapPins(await pins())) {
      const sent = JSON.parse(JSON.stringify(pin)) as Record<string, unknown>;
      expect(sent.locationText).toBeNull();
      expect(sent.complaintId).toBeNull();
      expect(sent.problem).toBeNull();
      expect(sent.needsReview).toBe(false);
      expect(sent.reportCount).toBe(0);
    }
  });

  it("the legend matches the pins: every public shape has the same color in the key", async () => {
    for (const pin of toPublicMapPins(await pins())) {
      const entry = PUBLIC_LEGEND.find((e) => e.shape === pin.shape);
      expect(entry, pin.shape).toBeDefined();
      expect(entry?.color, pin.shape).toBe(pin.color);
      expect(entry?.key, pin.shape).toBe(pin.statusKey);
    }
  });

  it("the public page does not import the signed-in map code", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("app/map/page.tsx", "utf8")).not.toContain('components/map/MapView"');
    const view = readFileSync("components/map/PublicMapView.tsx", "utf8");
    for (const forbidden of ['./MapView"', "listComplaints", "listWaterPoints", "getComplaint"]) expect(view).not.toContain(forbidden);
  });
});
