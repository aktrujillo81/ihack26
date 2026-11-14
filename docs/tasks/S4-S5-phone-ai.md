# Tasks S4 and S5: Vapi assistant and first test call

**Owner:** Phone / AI Prompter (and the developer who owns the Phone / AI work).
**Needs:** S4 needs S2 (Vapi account and key). S5 needs S3 (done) and S4.
**Unblocks:** S6 (`docs/contracts.md`), which unblocks D1, D3 to D6, and every web screen's real data. Nothing after S6 can finish until S5 is done, so these two tasks are the critical path.

## S4: Update the Vapi assistant
Only a human can change the live assistant. Do these in the Vapi dashboard, in order.

1. Open the assistant. Copy its current prompt, first message, and end-call message into "v1 as found" at the bottom of `docs/vapi-prompt.md`.
2. Check recording: is audio recording on? How long does Vapi keep calls and transcripts? Write the answers in `docs/spec.md` section 12, unknown 2. If recording is on, use the "recording on" greeting.
3. Paste the v2 system prompt and the matching first message from `docs/vapi-prompt.md`.
4. Leave the end-call message empty for the first test (see "End of the call" in the prompt file).
5. Set the maximum call length and silence timeout. A human decides 90 or 120 seconds (the prompt file explains the choice). If it is not 90, update `docs/budget.md`.
6. Add the analysis plan: the extraction prompt and the schema from `docs/vapi-prompt.md`. Enable only the `end-of-call-report` server message.
7. Create the webhook credential in Vapi (Bearer token or `X-Vapi-Secret`). Store the secret as `VAPI_WEBHOOK_SECRET` in `.env.local` and in the host server's `.env`. Add the **name** `VAPI_WEBHOOK_SECRET` to `.env.example` (names only). Never commit the value.
8. Change the status line in `docs/vapi-prompt.md` to "LIVE since <date and time>", and add a line to `docs/changelog.md`.

Done when: the prompt in the repo equals the prompt in Vapi, timeouts are set, and the recording answer is written down. No call is needed.

## S5: One paid test call and a sanitized payload
**A human must say OK before the call (red line 15), and the call goes in the spend log in `docs/budget.md`.**

### Before calling: how will the payload be captured?
The server does not yet have a Vapi endpoint (D3 needs the contract, which needs this payload). Something has to receive the first call. Options:

| Option | Notes |
|---|---|
| A. A tiny temporary capture route (recommended) | Backend task, one small PR. Accepts `POST` only with the shared secret (else 401), limits the body size, saves the raw body to a gitignored folder on the host, returns 200. Removed when D3 lands. Needs the agreement gate and Security's review, because it is public and writes to disk. |
| B. Read the call in the Vapi dashboard | No code. Shows the transcript and extracted data. Whether it shows the exact webhook body is **unknown**. Probably not enough to write the contract. |
| C. A public webhook-inspector website | **Do not use.** The payload holds the caller's phone number, and a third party would keep it. |

Choose A unless a human says otherwise. Without a captured body, S6 would be guessed, and red line 1 forbids that.

### The call
Keep it to one normal call of about 90 seconds. Call from your own phone, so the number in the payload is yours.
1. Set up: balance checked in the Vapi dashboard and written in the spend log; the capture route is up; the server URL and credential are set.
2. Say something like: "I am calling about a hand pump in Riverside village, near the market. There is no water. About one hundred and fifty people use it. A school uses it too. It has been a week." Then answer "Yes" to the read-back.
3. Listen for: the greeting notice, one question at a time, the read-back, the closing line said once, and a clean ending.
4. After: check the balance and write the cost in the spend log.

### After the call
1. Find the raw body in the gitignored folder. **Never commit it.**
2. Copy it to `docs/samples/` as a sanitized file. Remove or replace: the caller's phone number (`call.customer`, `customer.number`), the Vapi phone number, any recording URLs, and the call and account IDs. Keep every field name and the structure exactly. Do not tidy the structure.
3. Answer in the test log: where do the extracted fields appear? Which event types arrived? How was `serves_school_or_clinic` filled in? Did the closing line play once?
4. Fill the spec unknowns this answers: 1 (shape of the data), 3 (how requests are verified), and 4 (if a retry is visible). Check the real cost per minute against `docs/budget.md` (unknown 13).
5. Hand the sample and the log to the Orchestrator. S6 starts from them.

### Test log (copy per call)
```
VERSION: v2
CALL: <number>, <date and time>, <length>, <cost>, balance after <amount>
SAID: <what was said>
RESULT: <fields extracted correctly or not, per field>
NOTES: <ending, repeated closing line, anything odd>
```

## After S5: edge-case calls (from the dev test bucket)
The bucket is $1.80, about 20 minutes. After S5, plan at most six more calls of about 90 seconds each (about $0.80 together), then stop and check the balance. Suggested order, each needing a human's OK:
1. Cannot name a village, then names a school.
2. Says "I don't know" to people, school, and duration.
3. Gives a name and phone number unprompted.
4. Talks about something unrelated.
5. Speaks another language briefly.
6. Hangs up halfway.

Skipping the silence and "is the water safe?" cases is fine unless the first six show a problem. Anything else is tested by reading the saved payload, not by calling.

## Also owned by this role
- Q4 (three demo runs in a row) and Q8 (rehearsals): the assistant's behavior and the call budget.
- Before judging: the balance and the live prompt both checked (Q6).
- Keep `docs/vapi-prompt.md` equal to the live prompt on every change.

## Unknowns this work answers
| Unknown | Where recorded |
|---|---|
| Shape of the data Vapi sends and where the fields are | Spec section 12, unknown 1 |
| Whether recording is on, and how long Vapi keeps calls | Unknown 2 |
| How the endpoint verifies a request came from Vapi | Unknown 3 |
| What Vapi does if the endpoint is down or slow | Unknown 4 (needs a deliberate test; the endpoint down means a paid call, so a human decides) |
| Whether $0.09 per minute is the all-in rate, and any rounding up | Unknown 13 |
| How the call ends cleanly | `docs/vapi-prompt.md` |
