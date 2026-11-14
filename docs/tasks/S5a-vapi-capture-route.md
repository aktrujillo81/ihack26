# Task S5a: Temporary route to capture the first Vapi call

**Owner:** Backend (a developer who works on the server). **Reviewer:** Security, before merge.
**Needs:** S3 (done) and the webhook secret from S4 step 7.
**Unblocks:** S5 (the first paid test call), then S6 (`docs/contracts.md`).
**Size:** one small PR. **Temporary:** delete this route when D3 (the real Vapi endpoint) lands.

## Why
Nobody has seen what Vapi sends after a call. S6 (the contract) has to be written from a real payload, not guessed (red line 1). But the server has nothing yet that can receive Vapi's request. This route only catches the first call's data and saves it, so a human can read it. It does nothing else.

## What it does
`POST /api/vapi/capture`
1. **Fails closed.** If `VAPI_WEBHOOK_SECRET` is not set on the server, every request is refused.
2. **Checks the shared secret.** Accept the secret from `Authorization: Bearer <secret>` or from `X-Vapi-Secret` (the credential type is set in the Vapi dashboard in S4; support both). Compare in constant time. Missing or wrong: reply **401** with an empty body and save nothing.
3. **Limits the size.** A body over 2 MB gets **413** and is not saved. (The limit lives in `lib/config/`, not in the route.)
4. **Saves the body untouched.** The raw body is written to `docs/samples/raw/` (gitignored) as `capture-<UTC timestamp>-<random>.json`. The folder is created owner-only. Files are readable only by the owner.
5. **Stops after 20 files**, so a stranger who learns the URL cannot fill the disk. After that it still replies 200 but saves nothing, and logs a fixed code.
6. **Replies `200` with `{"ok":true}`.** It never sends the body, the secret, or any error detail back.

## What it must NOT do
- No parsing, validating, or interpreting the payload. That is D3.
- No database writes.
- No removing personal data. That is D3 (PR-3). The raw file **does** contain the caller's phone number, so it must stay out of git and off shared drives.
- No logging of the body or the secret. Log fixed codes only, like `[vapi-capture] saved` and `[vapi-capture] rejected`.
- It is not a permanent route. Put a `TEMPORARY` banner comment at the top of the file.

## Also change in the same PR
- `lib/config/env.ts`: add a server-only getter for `VAPI_WEBHOOK_SECRET`.
- `.env.example`: add the **name** `VAPI_WEBHOOK_SECRET` (no value).
- `docs/contracts.md`: add `POST /api/vapi/capture` under Endpoints, marked TEMPORARY, with its auth and responses.
- `docs/decisions.md`: one line saying why the route exists and when it is removed.

## Tests (no paid calls)
Use a temporary folder for the saved files.
| Case | Expected |
|---|---|
| No secret header | 401, nothing saved |
| Wrong secret | 401, nothing saved |
| `VAPI_WEBHOOK_SECRET` not set | refused, nothing saved |
| Body over the limit | 413, nothing saved |
| Correct secret and a small fake body | 200, one file saved, contents identical to the body |
| Body and secret never appear in logs | checked |
| After 20 saved files | 200, no new file |

Free check after deploying: `curl` the public URL with the right header and a fake body, then with a wrong header. Use a fake body only. Never put real call data through a test.

## Before the paid call
1. This PR is merged and running on the host server.
2. The Vapi credential is created and its secret is in the host server's `.env`.
3. In Vapi, the assistant's server URL is `https://bg.verilen.com/api/vapi/capture` and only `end-of-call-report` is sent.
4. A human has said OK and the balance is in the spend log (`docs/budget.md`).

## After the call
A person with access to the host copies the file out. It stays on a laptop, never in git. Remove personal data to make the sample in `docs/samples/` (steps are in `S4-S5-phone-ai.md`). Then delete the raw file from the host.

## Unknowns
| Unknown | How it gets answered |
|---|---|
| Does Vapi send the credential header when the server URL is set in the dashboard? (Its docs say yes, and that it does not when the URL comes from an API request.) | The free `curl` check can't answer this. The paid call does. If the file is not saved, check the header first. |
| Is the body JSON, and how big is a real one? | The saved file. If real calls exceed 2 MB, change the limit in `lib/config/`. |
| Does Vapi need a particular response? | It gets `200` with a small body. Note anything odd in the test log. |
| Who has access to the host's disk? | A human decides before the call. |
