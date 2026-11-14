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

## Tables
Unknown until S6. Added in task D1.
