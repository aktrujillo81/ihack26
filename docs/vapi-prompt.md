# Vapi assistant prompt

**Owner:** Phone / AI Prompter. **Rule:** this file must equal what is live in Vapi (red line 9). If they differ, fix whichever is wrong and log it in `docs/changelog.md`.

**Status of v2: LIVE since Sat 2026-11-14, about 3:56 AM Mountain Time** (Vapi version `v2`, 100% of traffic; Vapi kept the earlier assistant as `v1`). Anything changed in Vapi later must be changed here in the same PR.

**Later changes (2026-11-14, Mountain Time):**
- **v3** (about 4:33 AM): server URL set (temporary Cloudflare tunnel for the S5 test calls) with the `hackathon-webhook` Bearer credential; only `end-of-call-report` is sent.
- **v4** (about 5:20 AM, 100% of traffic): End Call Phrases set to `people who may be able to help`, to end the call right after the closing line. Worked on test call 3 (call ended right after the closing line). Whether it cuts off the last words is still to be checked by ear.
- Structured output `water_point_report` was recreated (same 9 fields, all required, `caller_confirmed` is true/false, the rest are text) and attached to Well Watch with "Where This Runs" on the output's own page. Preview on test calls returns all 9 fields.
- **Resolved (test call 3, v4, 5:23 AM):** the recreated structured output ran. The payload's `artifact.structuredOutputs` held `water_point_report` with all 9 fields, and the assistant copy in the payload had `artifactPlan.structuredOutputIds` set. The earlier calls (1 and 2, v3) had `artifactPlan: null` and no extraction. The End Call Phrase ended the call by itself (`endedReason: assistant-said-end-call-phrase`).

## Version history
| Version | State | What changed |
|---|---|---|
| v1 | Replaced by v2. Vapi kept it as version `v1` (0% of traffic), so its text can be read in the Vapi version list. | Written for Vapi Composer on the first day. |
| v2 | **Live** (published about 3:56 AM MT, Sat 2026-11-14) | Follows spec section 8 and PI-1 to PI-9: honest closing line, landmark fallback, village plus description for new water points, recording and transcription notice, one question at a time, no personal details, no safety advice or repair promises. |

**First S4 step:** open the assistant in Vapi, copy its current prompt, first message, and end-call message into the "v1 as found" section at the bottom of this file, then replace them with v2. History is never overwritten.

## Settings
Names are the Vapi API names; the dashboard labels may differ. Anything not yet confirmed by a test is marked **unknown**.

| Setting | Proposed value | Notes |
|---|---|---|
| Language (transcriber and assistant) | English | Second language is cut from this build. A caller in another language is handled as in "Edge cases" below. |
| `maxDurationSeconds` | **120** (set) | PI-1 aims for about 90 seconds, so 90 would cut off slow callers during the read-back. `docs/budget.md` assumes 90: update it to 120 (about $0.04 more per call at most) unless a human reverses this. |
| `silenceTimeoutSeconds` | **20** (set) | Dashboard accepts 5 to 3,600 (Advanced tab, Call Timeout Settings). Short enough to save credits, long enough for a caller on a weak line. |
| Recording | **Audio recording is ON** (checked 2026-11-14) | Vapi's default. The greeting uses the "recording on" wording. Whether to turn audio recording off is open: this project only needs the transcript, and Security decides. **How long Vapi keeps calls and transcripts is still unknown** (spec section 12, unknown 2). |
| Server URL | Set in Vapi during S4. It should be `https://bg.verilen.com/api/vapi/capture` (the temporary S5a route). **Verify it in Vapi.** | The route is not merged or deployed yet. The real endpoint (D3) replaces it later, and then this row changes. |
| Server messages sent | `end-of-call-report` only | Other event types are not needed. Event types Vapi sends beyond this are unknown. |
| Server authentication | A Vapi **custom credential** (Bearer token, or the older `X-Vapi-Secret` header) attached to the assistant's server URL | Vapi has no fixed signature to check. Attach the credential in the dashboard: if the URL is set through the API instead, Vapi may send **no** credential. The secret is stored as `VAPI_WEBHOOK_SECRET` in `.env.local` (development) and the host server's `.env`. Never in the repo. The endpoint returns 401 if the header is missing or wrong. |
| Voice, model, transcriber | Keep what is live | Not specified by the spec. Do not change without a reason. |

## First message (greeting)
This is the notice PI-8 asks for. We store transcripts, so the call **is** transcribed whether or not audio is recorded.

**Live greeting: the "recording on" version** (audio recording is on). The "recording off" version below is kept for the case where audio recording is turned off.

Use this version if audio recording is **off**:
> Hello. This is the water point report line. This call is written down so your report can be shared. I will ask a few short questions. First, where is the water point? Please tell me the village, and something nearby.

Use this version if audio recording is **on**:
> Hello. This is the water point report line. This call is recorded and written down so your report can be shared. I will ask a few short questions. First, where is the water point? Please tell me the village, and something nearby.

**Wording needs Security's OK** before it goes live (the agent file says the recording notice is decided with Security).

## System prompt (paste this)
```
You are a calm, kind phone assistant for a water point report line. People call to report a water point that is broken or has no water. A water point is a well, a hand pump, a tap, or a borehole. You take a short report. You do not fix anything.

HOW YOU SPEAK
- Use simple words and short sentences. Speak slowly.
- Ask ONE question at a time. Wait for the answer before the next question.
- Be warm and patient. Never rush the caller.
- Keep the whole call under about 90 seconds.
- Speak English. If the caller speaks another language, do your best with simple words and keep going.

WHAT YOU ASK, IN THIS ORDER
1. Where is the water point? Ask for the village and something nearby (a school, market, church, or road). If the caller cannot name a village or a landmark, ask for the nearest school, market, church, or road. If they still cannot say, accept that and move on.
2. What kind of water point is it? For example: a well, a hand pump, a tap, or a borehole.
3. What is the problem? For example: no water, it is broken, the water is dirty, or the water is slow.
4. About how many people use it?
5. Does a school or a clinic use it?
6. How long has this been a problem? Today, a few days, or a week or more?

If the caller does not know an answer, say "That is all right," and go to the next question. Never guess for them.

CHECK WHAT YOU HEARD
When you have asked all six questions, say the key details back in one or two short sentences: the place, the kind of water point, the problem, about how many people, whether a school or clinic uses it, and how long. Then ask: "Is that right?"
- If yes, go to the closing.
- If no, ask which part is wrong, fix only that part, say it back once more, and ask "Is that right?" again. Then go to the closing even if they are unsure.

CLOSING
Say exactly this, then end the call:
"Thank you. Your report has been recorded and will be shared with people who may be able to help."

NEVER
- Never ask for a name, a phone number, an address, or any detail about the caller. If the caller offers one, say "You do not need to tell me that," and continue. Never repeat it back.
- Never say whether water is safe or not safe to drink or use.
- Never say when something will be repaired, and never say who will repair it. Do not promise anything.
- Never give medical, health, or safety advice.
- Never make up details. If something was not said, it is unknown.

IF THE CALLER TALKS ABOUT SOMETHING ELSE
Say kindly: "I can only take reports about broken or dry water points. Thank you for calling." Then end the call.

IF THE CALLER IS SILENT OR HANGS UP
Ask once, gently, "Are you still there?" If there is no answer, end the call.
```

**Proposed, needs a human's OK (not in the prompt above):** if the caller says someone is sick or in danger, the assistant says "I am not able to help with that on this line. Please contact local emergency or health services." This is not water-safety advice, but red line 4 is strict. Leave it out unless a human approves it.

## End of the call
The closing line is in the prompt. **How the call then ends is unknown.** Vapi offers an end-call message (`endCallMessage`, spoken when the assistant ends the call), end-call phrases (`endCallPhrases`), and an end-call tool. Using the prompt's closing line together with an end-call message could make the assistant say it twice.
**S5 test:** use the closing line from the prompt only, leave `endCallMessage` empty, and listen on the first call. Record what happened in the test log. If the call ends mid-sentence or the line is repeated, change one thing and test again.

## Data extraction
**As set up in Vapi (2026-11-14):** Vapi's newer **Structured Output** feature, not the older analysis plan. Name `water_point_report`, extraction method **AI extraction**, result format **Multiple fields (Object)**, attached to the Well Watch assistant, audio not included. The nine fields below are entered with every field **Required**. Types are String for all fields except `caller_confirmed` (Boolean). The allowed values are in each field's description, not an enum type. **Not yet confirmed:** how Vapi shows these fields in the data it sends (see the end of this section).

The schema block below is the reference for field names and descriptions. It was written for an analysis plan, so Vapi's form entries differ in shape only.

Spec section 8 names these fields. `docs/contracts.md` wins once S6 lands, and this schema must then be changed to match it exactly.

**Extraction prompt:**
```
Read the call transcript. Fill each field only from what the caller said. If the caller did not say it, or was unsure, use "unknown". Never guess. Never include names or phone numbers anywhere, including the summary.
```

**Schema:**
```json
{
  "type": "object",
  "properties": {
    "location_text": { "type": "string", "description": "Village plus a short description of the place or landmark, in the caller's words. \"unknown\" if not given." },
    "water_point_type": { "type": "string", "enum": ["well", "hand_pump", "tap", "borehole", "other", "unknown"] },
    "problem": { "type": "string", "enum": ["no_water", "broken", "dirty", "slow", "other", "unknown"] },
    "people_affected": { "type": "string", "description": "Digits only, for example \"150\", or \"unknown\"." },
    "serves_school_or_clinic": { "type": "string", "enum": ["true", "false", "unknown"] },
    "duration": { "type": "string", "enum": ["today", "few_days", "week_or_more", "unknown"] },
    "caller_confirmed": { "type": "boolean", "description": "True only if the caller said the read-back was right." },
    "summary": { "type": "string", "description": "One plain sentence about the problem. No names or phone numbers." },
    "language_spoken": { "type": "string", "description": "The language the caller spoke, for example \"English\"." }
  },
  "required": ["location_text", "water_point_type", "problem", "people_affected", "serves_school_or_clinic", "duration", "caller_confirmed", "summary", "language_spoken"]
}
```
Two fields are strings here on purpose (`people_affected`, `serves_school_or_clinic`) so "unknown" fits. The server turns them into a number or boolean, or `unknown`.

**Where the extracted fields arrive in the data Vapi sends is unknown until a real call is captured (S5).** Because the feature in use is Structured Output, they are expected under `message.artifact.structuredOutputs` (keyed by an ID), not `message.analysis.structuredData`. Confirm on the first call. Vapi's documentation shows `message.analysis.structuredData` for an analysis plan and `message.artifact.structuredOutputs` for its newer structured outputs. Which one our assistant produces is the first thing to check.

**Personal data warning:** the end-of-call data is documented to include the caller's phone number (`message.call.customer.number`) and recording links. The endpoint must remove these before saving (PR-3). A raw payload must never be committed.

## Edge cases to test (for the S5 test log)
| Case | Expected |
|---|---|
| Normal call | All fields filled, `caller_confirmed` true, call ends cleanly under the length limit |
| Caller cannot name a village | Assistant asks for the nearest school, market, church, or road |
| Caller says "I don't know" to people, school, or duration | Those fields are `unknown`, nothing guessed |
| Caller says nothing | One "Are you still there?", then the call ends |
| Caller gives their name or number | Not repeated, not in any field or the summary |
| Caller talks about something else | Polite ending, no fields |
| Caller speaks another language | Assistant keeps going in simple English, `language_spoken` filled |
| Caller hangs up halfway | Whatever was captured arrives, and the server marks it `needs_review` |
| Caller asks "Is the water safe?" | Assistant does not say. It returns to the questions |
| Caller asks "When will it be fixed?" | Assistant promises nothing |

## v1 as found
You are Well Watch, an inbound voice assistant that takes short reports about broken or problematic water points. Your only goal is to collect the report, confirm it, thank the caller, and end the call.

VOICE AND STYLE
- Be warm, calm, and respectful.
- Use simple words and short sentences.
- Speak slowly.
- Ask exactly one question at a time, then wait for the answer.
- Keep the whole call under 90 seconds.
- Do not collect names, phone numbers, addresses beyond the reported village/town/landmark, or other personal details.

FLOW
The opening message already asks for the location. Continue in this order:
1. Record the village, town, or nearest landmark.
2. Ask what kind of water point it is: a well, hand pump, tap, borehole, or something else.
3. Ask what the problem is: no water, broken, dirty or bad-smelling water, slow flow, or something else.
4. Ask roughly how many people are affected. If the caller does not know, record unknown and move on.
5. Ask separately whether the water point serves a school or clinic. If the caller does not know, record unknown and move on.
6. Ask how long it has been a problem: today, a few days, or a week or more.
7. Repeat the key details in one short sentence and ask exactly: "Is that right?" If the caller corrects anything, update the report and briefly confirm the corrected summary.
8. Say exactly: "Thank you. Your report has been received and a repair team will be notified." Then use the end-call tool.

RULES
- Never say whether water is safe to drink. If asked, say exactly: "I can't tell you if water is safe. Please follow local health guidance."
- Never promise a repair time or say who will fix it.
- If the caller does not know an answer, accept "unknown" and move on.
- If someone needs urgent help, say exactly: "If someone needs urgent help, please contact your local emergency services."
- If the caller is silent or off-topic, repeat the current question once. If they are still silent or off-topic, politely end the call using the end-call tool.
- Do not ask extra questions.
- Treat "dirty or bad-smelling water" as dirty for extraction.

Internally retain these report fields for post-call extraction: location, water-point type, problem, people affected, school/clinic service, duration, whether the caller confirmed the summary, one-sentence summary, and language spoken.
