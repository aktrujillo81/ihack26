# Contracts

Data shapes, tables, endpoints, and rules. The full contract is written in
task S6 from a real captured Vapi payload. Anything not listed here is
**unknown**: do not guess.

## Endpoints

### `GET /api/health`
- **Purpose:** Uptime check for the app and its database (task S3).
- **Auth:** None. Public.
- **200:** `{ "status": "ok", "db": "ok" }`
- **503:** `{ "status": "error", "db": "down" }`
- **Rules:** Never returns error messages, hostnames, versions, or any data.
  Response is not cached (`Cache-Control: no-store`).

### `POST /api/vapi/capture` (TEMPORARY, task S5a)
- **Purpose:** Save the raw body of the first Vapi calls so this contract can be written from real data (S5, S6). **Remove when D3 lands.**
- **Auth:** Shared secret from the Vapi credential, in `Authorization: Bearer <secret>` or `X-Vapi-Secret: <secret>`, compared in constant time. If `VAPI_WEBHOOK_SECRET` is unset, every request is refused.
- **401:** Missing or wrong secret. Empty body. Nothing saved.
- **413:** Body over the limit in `lib/config/vapi-capture.ts` (2 MB). Nothing saved.
- **200:** `{ "ok": true }`. The body is saved untouched to `docs/samples/raw/` (gitignored), one owner-only file per request. After 20 saved files, still 200, nothing saved.
- **500:** `{ "ok": false }` when the file cannot be written.
- **Rules:** No parsing, validation, cleaning, or database writes. The saved files contain the caller's phone number: never commit or share them. Logs use fixed codes only (`[vapi-capture] saved`, `rejected`, `too_large`, `limit_reached`, `save_failed`), never the body or the secret. Not cached.

## Tables
Unknown until S6. Added in task D1.
