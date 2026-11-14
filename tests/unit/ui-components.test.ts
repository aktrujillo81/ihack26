import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { PriorityBars } from "@/components/ui/PriorityBars";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusChip } from "@/components/ui/StatusChip";
import { t } from "@/lib/i18n/strings";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("StatusChip: shape + word + color, never color alone", () => {
  const cases = [
    { status: "open", word: "Open", shape: "<circle" },
    { status: "passed_on", word: "Passed on", shape: "<polygon" },
    { status: "fixed", word: "Fixed", shape: "<rect" },
  ] as const;

  for (const { status, word, shape } of cases) {
    it(`${status} shows the word "${word}", its shape and its own style`, () => {
      const out = html(createElement(StatusChip, { status }));
      expect(out).toContain(word);
      expect(out).toContain(shape);
      expect(out).toContain(`ww-chip--${status}`);
      expect(out).toContain('aria-hidden="true"');
    });
  }

  it("the three statuses use three different shapes", () => {
    const shapes = cases.map(({ status }) => html(createElement(StatusChip, { status })).match(/<(circle|polygon|rect)/)?.[1]);
    expect(new Set(shapes).size).toBe(3);
  });

  it("unknown, missing and unrecognized values all show the word Unknown with the dashed diamond, never blank", () => {
    for (const status of ["unknown", "", "bogus", null, undefined, "OPEN", "<script>"]) {
      const out = html(createElement(StatusChip, { status: status as string | null | undefined }));
      expect(out, String(status)).toContain(t("common.unknown"));
      expect(out).toContain("ww-chip--unknown");
      expect(out).toContain('points="6,1 11,6 6,11 1,6"');
      expect(out).not.toContain("<script>");
    }
  });
});

describe("PriorityBars: three rising bars plus the word", () => {
  const count = (out: string, cls: string) => (out.match(new RegExp(`class="${cls}"`, "g")) ?? []).length;
  for (const [level, word, on] of [["high", "High", 3], ["medium", "Medium", 2], ["low", "Low", 1]] as const) {
    it(`${level}: ${on} filled bar(s) and the word "${word}"`, () => {
      const out = html(createElement(PriorityBars, { level }));
      expect(count(out, "ww-bar-on")).toBe(on);
      expect(count(out, "ww-bar-off")).toBe(3 - on);
      expect(out).toContain(word);
      expect(out).toContain('aria-hidden="true"');
    });
  }
});

describe("SampleDataTag, Panel, Button", () => {
  it("the sample data tag uses the shared wording", () => {
    expect(html(createElement(SampleDataTag))).toContain(t("common.sampleData"));
  });

  it("a panel is a padded section by default, and can be another element", () => {
    expect(html(createElement(Panel, null, "x"))).toBe('<section class="ww-panel ww-panel--padded">x</section>');
    expect(html(createElement(Panel, { as: "div", padded: false, tile: true }, "x"))).toBe('<div class="ww-panel ww-panel--tile">x</div>');
  });

  it("a button never submits a form by accident, and has the three variants", () => {
    expect(html(createElement(Button, null, "Go"))).toBe('<button type="button" class="ww-btn">Go</button>');
    expect(html(createElement(Button, { variant: "primary" }, "Go"))).toContain("ww-btn--primary");
    expect(html(createElement(Button, { variant: "text" }, "Go"))).toContain("ww-btn--text");
    expect(html(createElement(Button, { type: "submit" }, "Go"))).toContain('type="submit"');
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
  ] as const;

  it("is a named group of buttons; exactly the chosen one has aria-pressed=true", () => {
    const out = html(createElement(SegmentedControl, { label: "Filter", options, value: "open", onChange: () => {} }));
    expect(out).toContain('role="group"');
    expect(out).toContain('aria-label="Filter"');
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(out.match(/aria-pressed="false"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-pressed="true"[^>]*>Open</);
  });
});

describe("the stylesheet follows the style guide", () => {
  const css = readFileSync("components/ui/ui.css", "utf8");

  it("has the 3px accent focus ring and no raw hex colors, px font sizes or px radii", () => {
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline:\s*3px solid var\(--ww-focus\)/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/font-size:\s*\d+px/);
    expect(css).not.toMatch(/border-radius:\s*\d+px/);
  });

  it("uses the card shadow token and no other shadow", () => {
    expect(css).toContain("box-shadow: var(--ww-shadow-card)");
    expect((css.match(/box-shadow/g) ?? []).length).toBe(1);
  });
});
