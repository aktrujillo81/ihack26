import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCaptureHandler } from "@/lib/vapi/capture";

const SECRET = "test-shared-secret";
const BODY = JSON.stringify({ message: { type: "end-of-call-report", note: "fake test body" } });

let dir: string;

function handler(overrides: Partial<Parameters<typeof createCaptureHandler>[0]> = {}) {
  return createCaptureHandler({ secret: SECRET, directory: dir, maxBodyBytes: 1024, maxFiles: 3, ...overrides });
}

function post(headers: Record<string, string>, body: string = BODY) {
  return new Request("http://localhost/api/vapi/capture", { method: "POST", headers, body });
}

const saved = async () => (await readdir(dir).catch(() => [])).filter((n) => n.startsWith("capture-"));

describe("POST /api/vapi/capture (temporary, S5a)", () => {
  beforeEach(async () => {
    dir = path.join(await mkdtemp(path.join(tmpdir(), "vapi-capture-")), "raw");
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(path.dirname(dir), { recursive: true, force: true });
  });

  it("rejects a request with no secret header and saves nothing", async () => {
    const res = await handler()(post({}));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
    expect(await saved()).toHaveLength(0);
  });

  it("rejects a wrong secret and saves nothing", async () => {
    const res = await handler()(post({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(await saved()).toHaveLength(0);
  });

  it("refuses everything when no secret is configured", async () => {
    for (const secret of [undefined, ""]) {
      const res = await handler({ secret })(post({ authorization: "Bearer " }));
      expect(res.status).toBe(401);
    }
    expect(await saved()).toHaveLength(0);
  });

  it("refuses a body over the limit", async () => {
    const res = await handler({ maxBodyBytes: 10 })(post({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(413);
    expect(await saved()).toHaveLength(0);
  });

  it("saves the body untouched with a Bearer secret", async () => {
    const res = await handler()(post({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const files = await saved();
    expect(files).toHaveLength(1);
    expect(await readFile(path.join(dir, files[0]), "utf8")).toBe(BODY);
  });

  it("accepts the legacy X-Vapi-Secret header", async () => {
    const res = await handler()(post({ "x-vapi-secret": SECRET }));
    expect(res.status).toBe(200);
    expect(await saved()).toHaveLength(1);
  });

  it("stops saving after the file limit but still answers 200", async () => {
    const h = handler({ maxFiles: 2 });
    for (let i = 0; i < 3; i++) {
      const res = await h(post({ authorization: `Bearer ${SECRET}` }));
      expect(res.status).toBe(200);
    }
    expect(await saved()).toHaveLength(2);
  });

  it("answers 500 when the body cannot be saved", async () => {
    // A file where the folder should be makes saving fail.
    await writeFile(dir, "not a folder");
    const res = await handler()(post({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("never logs the body or the secret", async () => {
    const lines: string[] = [];
    const record = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
    vi.spyOn(console, "log").mockImplementation(record);
    vi.spyOn(console, "error").mockImplementation(record);
    await handler()(post({ authorization: `Bearer ${SECRET}` }));
    await handler()(post({ authorization: "Bearer wrong" }));
    const all = lines.join("\n");
    expect(all).not.toContain(SECRET);
    expect(all).not.toContain("fake test body");
    expect(lines.every((l) => l.startsWith("[vapi-capture] "))).toBe(true);
  });
});
