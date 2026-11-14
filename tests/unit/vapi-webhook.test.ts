import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { saveReport as stubSaveReport } from "@/lib/ingest/save-report";
import type { ValidatedReport } from "@/lib/ingest/types";
import { createWebhookHandler, type LogCode, type WebhookDeps } from "@/lib/ingest/webhook";

// Every value below is invented at runtime. No real payload is committed.
const SECRET = `test-secret-${randomUUID()}`;
const KEY = randomBytes(24).toString("hex"); // 48 characters
const CALL_ID = `call-${randomUUID()}`;
const SCOPE = { ok: true as const, organizationId: randomUUID(), regionId: randomUUID() };

function goodResult(overrides: Record<string, unknown> = {}) {
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

function payload(opts: { result?: unknown; type?: string; callId?: string | null; endedReason?: unknown; outputs?: unknown } = {}) {
  const outputs = opts.outputs ?? { [randomUUID()]: { name: "water_point_report", result: opts.result ?? goodResult() } };
  return {
    message: {
      type: opts.type ?? "end-of-call-report",
      endedReason: opts.endedReason ?? "customer-ended-call",
      call: opts.callId === null ? {} : { id: opts.callId ?? CALL_ID },
      artifact: { structuredOutputs: outputs },
    },
  };
}

function request(body: BodyInit | null, headers: HeadersInit = { authorization: `Bearer ${SECRET}` }, init: RequestInit = {}) {
  return new Request("http://localhost/api/vapi/webhook", { method: "POST", headers, body, ...init });
}
const post = (obj: unknown, headers?: HeadersInit) => request(JSON.stringify(obj), headers);

function setup(overrides: Partial<WebhookDeps> = {}) {
  const saved: ValidatedReport[] = [];
  const logs: LogCode[] = [];
  const saveReport = vi.fn(async (report: ValidatedReport) => {
    saved.push(report);
    return { ok: true as const, repeat: false };
  });
  const loadScope = vi.fn(async () => SCOPE);
  const handle = createWebhookHandler({
    secret: SECRET,
    callRefKey: KEY,
    loadScope,
    saveReport,
    log: (code) => logs.push(code),
    ...overrides,
  });
  return { handle, saved, logs, saveReport, loadScope };
}

afterEach(() => vi.restoreAllMocks());

describe("secret check (contracts 2, step 1)", () => {
  it("accepts the Bearer header and logs which one matched", async () => {
    const t = setup();
    expect((await t.handle(post(payload()))).status).toBe(200);
    expect(t.logs).toContain("auth_bearer");
  });

  it("accepts X-Vapi-Secret and logs which one matched", async () => {
    const t = setup();
    expect((await t.handle(post(payload(), { "x-vapi-secret": SECRET }))).status).toBe(200);
    expect(t.logs).toContain("auth_x_vapi_secret");
  });

  it("refuses no secret, a wrong secret and an empty bearer, with an empty body, before reading or storing anything", async () => {
    const cases: HeadersInit[] = [{}, { authorization: "Bearer nope" }, { "x-vapi-secret": "nope" }, { authorization: "Bearer " }];
    for (const headers of cases) {
      const t = setup();
      const res = await t.handle(post(payload(), headers));
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("");
      expect(t.loadScope).not.toHaveBeenCalled();
      expect(t.saveReport).not.toHaveBeenCalled();
      expect(t.logs).toEqual(["rejected"]);
    }
  });

  it("refuses everything while the secret is unset or empty", async () => {
    for (const secret of [undefined, ""]) {
      const t = setup({ secret });
      expect((await t.handle(post(payload(), { authorization: "Bearer " }))).status).toBe(401);
      expect((await t.handle(post(payload(), { "x-vapi-secret": "" }))).status).toBe(401);
      expect(t.saveReport).not.toHaveBeenCalled();
    }
  });
});

describe("rate limit: only failed attempts count", () => {
  const ip = (n: string) => ({ "cf-connecting-ip": n });

  it("429 after the limit from one IP, checked first; another IP with a valid secret is unaffected", async () => {
    let t = 1_000;
    const h = setup({ badSecretLimit: { max: 3, windowSeconds: 60 }, now: () => t });
    for (let i = 0; i < 3; i++) expect((await h.handle(post(payload(), { ...ip("203.0.113.9"), authorization: "Bearer x" }))).status).toBe(401);
    expect((await h.handle(post(payload(), { ...ip("203.0.113.9"), authorization: "Bearer x" }))).status).toBe(429);
    // Even the right secret from the limited IP waits: the limit is checked before anything else.
    const limited = await h.handle(post(payload(), { ...ip("203.0.113.9"), authorization: `Bearer ${SECRET}` }));
    expect(limited.status).toBe(429);
    expect(await limited.text()).toBe("");
    expect((await h.handle(post(payload(), { ...ip("203.0.113.10"), authorization: `Bearer ${SECRET}` }))).status).toBe(200);
    // The window passes: allowed again.
    t += 61_000;
    expect((await h.handle(post(payload(), { ...ip("203.0.113.9"), authorization: `Bearer ${SECRET}` }))).status).toBe(200);
  });

  it("valid requests never use the limit", async () => {
    const h = setup({ badSecretLimit: { max: 2, windowSeconds: 60 } });
    for (let i = 0; i < 10; i++) expect((await h.handle(post(payload(), { authorization: `Bearer ${SECRET}`, ...ip("203.0.113.9") }))).status).toBe(200);
  });

  it("with no valid client IP header, all such requests share one bucket", async () => {
    const h = setup({ badSecretLimit: { max: 2, windowSeconds: 60 } });
    await h.handle(post(payload(), { authorization: "Bearer x" }));
    await h.handle(post(payload(), { authorization: "Bearer x", "cf-connecting-ip": "not an ip" }));
    expect((await h.handle(post(payload(), { authorization: "Bearer x" }))).status).toBe(429);
  });
});

describe("size limit (contracts 2, step 2)", () => {
  it("413 from the declared length, without reading or storing", async () => {
    const t = setup({ maxBodyBytes: 100 });
    const res = await t.handle(request("x".repeat(500), { authorization: `Bearer ${SECRET}`, "content-length": "500" }));
    expect(res.status).toBe(413);
    expect(await res.text()).toBe("");
    expect(t.saveReport).not.toHaveBeenCalled();
    expect(t.logs).toContain("too_large");
  });

  it("413 for a chunked body with no content-length, counted while streaming", async () => {
    const t = setup({ maxBodyBytes: 100 });
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 50) return controller.close();
        controller.enqueue(new Uint8Array(40));
      },
    });
    const req = new Request("http://localhost/api/vapi/webhook", {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}` },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(req.headers.get("content-length")).toBeNull();
    expect((await t.handle(req)).status).toBe(413);
    expect(pulled).toBeLessThan(10); // stopped reading, did not buffer everything
    expect(t.saveReport).not.toHaveBeenCalled();
  });

  it("a lying small content-length does not bypass the streamed count", async () => {
    const t = setup({ maxBodyBytes: 100 });
    const res = await t.handle(request("x".repeat(500), { authorization: `Bearer ${SECRET}`, "content-length": "5" }));
    expect(res.status).toBe(413);
  });
});

describe("scope (contracts 2, step 3)", () => {
  it("503 when there is no single intake.phone row; nothing stored", async () => {
    const t = setup({ loadScope: async () => ({ ok: false }) });
    const res = await t.handle(post(payload()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(t.saveReport).not.toHaveBeenCalled();
    expect(t.logs).toContain("no_scope");
  });

  it("organization and region come from the row, never the request", async () => {
    const t = setup();
    const body = payload();
    (body.message as Record<string, unknown>).organizationId = randomUUID();
    await t.handle(post(body));
    expect(t.saved[0].organizationId).toBe(SCOPE.organizationId);
    expect(t.saved[0].regionId).toBe(SCOPE.regionId);
  });

  it("a malformed body still gets the scope from the row", async () => {
    const t = setup();
    await t.handle(request("{not json"));
    expect(t.saved[0]).toMatchObject({ organizationId: SCOPE.organizationId, regionId: SCOPE.regionId });
  });

  it("503 (not a crash) when the lookup throws, and nothing is logged but a code", async () => {
    const spy = vi.spyOn(console, "error");
    const t = setup({ loadScope: async () => { throw new Error(`boom ${CALL_ID}`); } });
    expect((await t.handle(post(payload()))).status).toBe(500);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("parse and find (contracts 2, steps 4 and 5)", () => {
  it("another event type is ignored: 200, nothing stored", async () => {
    const t = setup();
    const res = await t.handle(post(payload({ type: "status-update" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(t.saveReport).not.toHaveBeenCalled();
    expect(t.logs).toContain("ignored_type");
  });

  it("malformed bodies are handed over as malformed_payload with nothing from the body", async () => {
    const SENTINEL = `sentinel-${randomUUID()}`;
    const bodies = [`{"message": "${SENTINEL}`, JSON.stringify([SENTINEL]), JSON.stringify({ message: { note: SENTINEL } }), JSON.stringify({ message: { type: 5, note: SENTINEL } }), JSON.stringify({ message: SENTINEL }), JSON.stringify(SENTINEL), "", "\u0000\u0001"];
    for (const body of bodies) {
      const t = setup();
      expect((await t.handle(request(body))).status).toBe(200);
      expect(t.saved).toHaveLength(1);
      const r = t.saved[0];
      expect(r).toMatchObject({
        needsReview: true, needsReviewReason: "malformed_payload", locationText: "unknown", waterPointType: "unknown",
        problem: "unknown", duration: "unknown", peopleAffected: null, servesSchoolOrClinic: null, callerConfirmed: null,
        summary: null, languageSpoken: null, transcript: null, providerCallRef: null, endedReason: null,
      });
      expect(JSON.stringify(r)).not.toContain(SENTINEL);
    }
  });

  it("no structured output (key missing, no match, several matches, bad result): no_structured_data, all unknown", async () => {
    const named = (result: unknown) => ({ [randomUUID()]: { name: "water_point_report", result } });
    const cases: unknown[] = [
      undefined, // key missing entirely
      {},
      { a: { name: "something_else", result: goodResult() } },
      { ...named(goodResult()), ...named(goodResult()) },
      named(null),
      named("text"),
      named([goodResult()]),
    ];
    for (const outputs of cases) {
      const t = setup();
      const body = payload({ outputs });
      if (outputs === undefined) delete (body.message.artifact as Record<string, unknown>).structuredOutputs;
      expect((await t.handle(post(body))).status).toBe(200);
      expect(t.saved[0]).toMatchObject({ needsReview: true, needsReviewReason: "no_structured_data", locationText: "unknown", problem: "unknown", callerConfirmed: null });
      expect(t.saved[0].endedReason).toBe("customer-ended-call");
    }
  });

  it("finds the entry by trimmed, lowercased name and never uses its id", async () => {
    const t = setup();
    await t.handle(post(payload({ outputs: { "weird id": { name: "  Water_Point_Report ", result: goodResult() } } })));
    expect(t.saved[0].needsReviewReason).toBeNull();
    expect(t.saved[0].waterPointType).toBe("hand_pump");
  });
});

describe("the hand-over (types, call reference, no leaks)", () => {
  it("the sample-like call normalizes to the contracts 3 shape", async () => {
    const t = setup();
    await t.handle(post(payload({ endedReason: "assistant-said-end-call-phrase" })));
    expect(t.saved[0]).toEqual({
      organizationId: SCOPE.organizationId,
      regionId: SCOPE.regionId,
      providerCallRef: createHmac("sha256", KEY).update(CALL_ID).digest("hex"),
      channel: "phone",
      locationText: "Riverside Village near the market",
      waterPointType: "hand_pump",
      problem: "no_water",
      peopleAffected: 150,
      servesSchoolOrClinic: true,
      duration: "week_or_more",
      callerConfirmed: true,
      summary: "The hand pump has no water.",
      languageSpoken: "English",
      transcript: null,
      endedReason: "assistant-said-end-call-phrase",
      needsReview: false,
      needsReviewReason: null,
    });
  });

  it("the raw call id never reaches the handed-over object, the response or the logs", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const saved: ValidatedReport[] = [];
    // The default logger (console) is used here on purpose.
    const handle = createWebhookHandler({
      secret: SECRET, callRefKey: KEY, loadScope: async () => SCOPE,
      saveReport: async (r) => { saved.push(r); return { ok: true, repeat: false }; },
    });
    const bodyObj = payload();
    const res = await handle(post(bodyObj));
    await handle(post(bodyObj, { authorization: "Bearer wrong" }));
    await handle(request("{broken " + CALL_ID));
    const everything = JSON.stringify([saved, await res.text(), out.mock.calls, err.mock.calls, warn.mock.calls]);
    expect(everything).not.toContain(CALL_ID);
    expect(everything).not.toContain(SECRET);
    expect(everything).not.toContain(KEY);
    // Only fixed codes were logged.
    for (const call of [...out.mock.calls, ...err.mock.calls]) expect(String(call[0])).toMatch(/^\[vapi-webhook\] [a-z_]+$/);
  });

  it("a missing or non-string call id gives a null ref (no dedupe), without failing", async () => {
    for (const callId of [null, undefined as unknown as string]) {
      const t = setup();
      const body = payload({ callId });
      if (callId === undefined) (body.message as Record<string, unknown>).call = { id: 42 };
      expect((await t.handle(post(body))).status).toBe(200);
      expect(t.saved[0].providerCallRef).toBeNull();
    }
  });

  it("no HMAC key (unset or too short, as env.ts reports it) gives 503 and never stores a null ref", async () => {
    const t = setup({ callRefKey: undefined });
    const res = await t.handle(post(payload()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(t.saveReport).not.toHaveBeenCalled();
    expect(t.logs).toContain("store_failed");
    // A malformed body is no exception.
    expect((await t.handle(request("{"))).status).toBe(503);
    expect(t.saveReport).not.toHaveBeenCalled();
  });

  it("an unknown event type still gets 200 without a key (nothing would be stored anyway)", async () => {
    const t = setup({ callRefKey: undefined });
    expect((await t.handle(post(payload({ type: "status-update" })))).status).toBe(200);
  });
});

describe("responses from the save function", () => {
  it("a repeat delivery answers exactly like a first one", async () => {
    const first = setup();
    const repeat = setup({ saveReport: async () => ({ ok: true, repeat: true }) });
    const a = await first.handle(post(payload()));
    const b = await repeat.handle(post(payload()));
    expect(b.status).toBe(a.status);
    expect(await b.text()).toBe(await a.text());
    expect([...b.headers].sort()).toEqual([...a.headers].sort());
    expect(repeat.logs).toContain("repeat");
    expect(first.logs).toContain("stored");
  });

  it("the shipped stub never answers 200: it is 503 store_failed", async () => {
    const logs: LogCode[] = [];
    const handle = createWebhookHandler({ secret: SECRET, callRefKey: KEY, loadScope: async () => SCOPE, saveReport: stubSaveReport, log: (c) => logs.push(c) });
    const res = await handle(post(payload()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(logs).toContain("store_failed");
    expect(logs).not.toContain("stored");
  });

  it("a failure result is 503; a throw is 500; neither logs the error", async () => {
    const spy = vi.spyOn(console, "error");
    const failing = setup({ saveReport: async () => ({ ok: false, reason: "store_failed" }) });
    expect((await failing.handle(post(payload()))).status).toBe(503);
    const throwing = setup({ saveReport: async () => { throw new Error(`secret detail ${CALL_ID}`); } });
    const res = await throwing.handle(post(payload()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
    expect(spy).not.toHaveBeenCalled();
  });

  it("responses are not cached", async () => {
    const t = setup();
    expect((await t.handle(post(payload()))).headers.get("cache-control")).toBe("no-store");
    expect((await t.handle(post(payload(), {}))).headers.get("cache-control")).toBe("no-store");
  });
});
