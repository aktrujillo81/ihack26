# Well Watch lenses (put this file at docs/lenses.md)

A lens is a viewpoint. Before we build something (the spec) and before we ship it (the demo), we look at it through all three lenses. A lens can say **yes**, **no, because...**, or **unknown**. Unknown is fine as long as we write it down.

**Rule:** The spec passes when all three lenses say yes, or when every "no" has a fix and every "unknown" is written in docs/spec.md under Open questions.

---

## 1. Builder (engineer / maintainer)
**Who:** The person who has to keep this code running and changing a year from now.
**Core questions:**
- Will the people maintaining this code be proud of it?
- Is the design respectful of their time?
- Would you want to be on call for it?

**Ask of every spec and PR:**
- Could a new teammate understand this in 10 minutes?
- Is every route, table, and rule written in docs/contracts.md?
- If it breaks at 2 AM, will we notice, and can we tell why?
- Are there tests for the tricky cases (missing fields, "unknown", duplicates)?
- Is anything clever that could be simple?
- Are secrets and settings kept out of the code?

**Watch out for in Well Watch:**
- A phone-call endpoint that silently drops bad payloads.
- Scoring rules buried in code that nobody can explain.
- Landmark matching that guesses instead of saying "needs review".

---

## 2. Adopter (the caller / reporter)
**Who:** The person who calls the number to report a broken or dry water point. They may have a basic phone, a weak signal, little time, and may speak English as a second language.
**Core question:** Would I actually make this call, finish it, and call again next time?

**Ask of every spec and PR:**
- Does it work on a basic phone with no app and no data?
- Is the call short and simple, one question at a time?
- Can I answer in my own words, and what happens if I don't know the landmark?
- Do I know my report was received?
- Will I ever hear that something was fixed? (If never, I stop calling.)
- Am I asked for personal details, or afraid of being tracked?
- Does the assistant avoid giving advice or promises it can't keep, like "it's safe to drink" or "a crew is coming Tuesday"?

**Watch out for in Well Watch:**
- A long call, or an assistant that talks too much.
- Not recognizing local place names.
- No closing the loop, so reporters lose trust.

---

## 3. Responder (NGO coordinator)
**Who:** A person at a non-governmental organization who looks at the map, sees what is wrong and where, and connects the problem to the organizations that can fix it (repair technicians, water committees, local government, other NGOs).
**Core question:** Can I trust this report enough to pass it on, and can I describe it well enough that someone else can act on it?

**Ask of every spec and PR:**
- Can I find the place? (landmark, coordinates, and the nearest known water point)
- Do I see what is wrong, how many people depend on it, how long it has been broken, and whether a school or clinic is affected?
- Do I see how sure the system is? (number of reports, "needs review" flags)
- Can I sort by what is most urgent?
- Can I hand it off? (a clear summary I can copy or forward)
- Can I see the status: reported, passed on, fixed?
- Am I flooded with duplicates or noise?
- Does a human, me, decide what happens next?

**Watch out for in Well Watch:**
- A map that looks nice but hides the summary and priority.
- No way to record who the report was passed to.
- Pins that look certain when the data is a guess.

---

## Lens review prompt (use at T3b and before the freeze)
```
Read docs/spec.md and docs/contracts.md. Review them through three lenses, one at a time: Builder, Adopter, and Responder (described in docs/lenses.md).

For each lens give:
- Verdict: yes, no, or unknown
- The top 3 problems or gaps
- Anything you can't tell, written as "unknown"

Then list the 5 most important fixes, ordered by risk. Do not suggest new features.
```
