# Vapi assistant prompt

**Owner:** Phone / AI Prompter. **Rule:** this file must equal what is live in Vapi (red line 9). If they differ, fix whichever is wrong and log it in `docs/changelog.md`.

**Status of v2: DRAFT. Not live.** A human pastes it into Vapi (task S4), then changes this status line to "LIVE since <date and time>".

## Version history
| Version | State | What changed |
|---|---|---|
| v1 | Live in Vapi today. **Text not in the repo (unknown).** | Written for Vapi Composer on the first day. |
| v2 | Draft in this file | Follows spec section 8 and PI-1 to PI-9: honest closing line, landmark fallback, village plus description for new water points, recording and transcription notice, one question at a time, no personal details, no safety advice or repair promises. |

**First S4 step:** open the assistant in Vapi, copy its current prompt, first message, and end-call message into the "v1 as found" section at the bottom of this file, then replace them with v2. History is never overwritten.

## Settings
Names are the Vapi API names; the dashboard labels may differ. Anything not yet confirmed by a test is marked **unknown**.

| Setting | Proposed value | Notes |
|---|---|---|
| Language (transcriber and assistant) | English | Second language is cut from this build. A caller in another language is handled as in "Edge cases" below. |
| `maxDurationSeconds` | **120** | PI-1 aims for about 90 seconds, so 90 would cut off slow callers during the read-back. `docs/budget.md` assumes 90. The difference is about $0.04 a call. **A human decides** and updates whichever file loses. |
| `silenceTimeoutSeconds` | **20** | Dashboard accepts 5 to 3,600 (Advanced tab, Call Timeout Settings). Short enough to save credits, long enough for a caller on a weak line. |
| Recording | **Unknown. Check it.** | Open the assistant's Advanced settings and look for audio recording. Write the answer in spec section 12, unknown 2. Also check how long Vapi keeps calls and transcripts. |
| Server URL | `https://bg.verilen.com/api/vapi/webhook` | **Proposed path. The route does not exist yet** (task D3). Set it during S5, when something is ready to receive the call. |
| Server messages sent | `end-of-call-report` only | Other event types are not needed. Event types Vapi sends beyond this are unknown. |
| Server authentication | A Vapi **custom credential** (Bearer token, or the older `X-Vapi-Secret` header) attached to the assistant's server URL | Vapi has no fixed signature to check. Attach the credential in the dashboard: if the URL is set through the API instead, Vapi may send **no** credential. The secret is stored as `VAPI_WEBHOOK_SECRET` in `.env.local` (development) and the host server's `.env`. Never in the repo. The endpoint returns 401 if the header is missing or wrong. |
| Voice, model, transcriber | Keep what is live | Not specified by the spec. Do not change without a reason. |

## First message (greeting)
This is the notice PI-8 asks for. We store transcripts, so the call **is** transcribed whether or not audio is recorded.

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

## Data extraction (analysis plan)
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

**Where the extracted fields arrive in the data Vapi sends is unknown until a real call is captured (S5).** Vapi's documentation shows `message.analysis.structuredData` for an analysis plan and `message.artifact.structuredOutputs` for its newer structured outputs. Which one our assistant produces is the first thing to check.

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
_To be pasted from the live Vapi assistant by a human during S4. Leave this heading in place._
