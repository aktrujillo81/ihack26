# Sanitized call samples

Only sanitized payloads may be committed here. Raw payloads belong in the
gitignored `docs/samples/raw/` directory and must never be committed.


## `vapi-end-of-call-report.sample.json`
A cleaned copy of the first real Vapi `end-of-call-report` that carried extracted data (test call 3, 2026-11-14, assistant version v4). It was built from the raw capture with an **allowlist**: only the fields listed below were copied, so anything not named here is gone.

**What is fake or removed**
- The caller number is replaced by the word `REDACTED` (in `message.call.customer.number` and `message.customer.number`), because the pattern guard in `tests/unit/guards.test.ts` forbids phone-shaped text in this folder, fake or not. Tests of the number-stripping code should build a fake number at runtime and put it into a copy of this sample.
- Removed entirely: recording and log links (the sample keeps the keys with the value `REMOVED`), the call ID, the organization and account IDs, the phone number record, SIP and carrier details, caller IP addresses, the `variables` and `variableValues` copies, and the copy of the assistant settings.
- The structured output ID is a placeholder (`00000000-0000-4000-8000-000000000001`). The real ID is different in every Vapi account.
- System-role messages (the assistant's instructions) are dropped from `messages`.
- The transcript is kept. It holds only the scripted test answers, with no caller name.

**What the real payload showed** (these were unknowns in `docs/spec.md` and `docs/vapi-prompt.md`)
- The extracted fields are at `message.artifact.structuredOutputs.<id>.result`. The `<id>` is the structured output's own ID, so the server must find it by `name` (`water_point_report`), not by ID. `message.analysis` is empty (`{}`) and `message.summary` is an empty string.
- The nine fields come back as expected: `people_affected` and `serves_school_or_clinic` are strings (`"150"`, `"true"`), `caller_confirmed` is a boolean.
- The caller's phone number is in `message.call.customer.number` and `message.customer.number`. The raw payload also repeats it in other places (`variables`, SIP details), so the endpoint should keep an allowlist and never save the raw body.
- `endedReason` values seen so far: `customer-ended-call` and `assistant-said-end-call-phrase`.
- Vapi sent the credential on the request. The D3a webhook accepts the recorded Bearer form or `X-Vapi-Secret`, and never stores the raw body.
- Calls 1 and 2 (assistant v3) arrived with no structured data at all. Check for a missing `structuredOutputs` key and handle it as `needs_review`, not as an error.
