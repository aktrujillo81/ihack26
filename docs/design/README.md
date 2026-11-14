# Design reference

Static HTML exports of the approved Well Watch screens. Open any file in a browser to see it.

- operations-console.html: complaints list with summary tiles and map (W2, W4)
- complaint-detail.html: complaint detail (W3)
- needs-review.html: Needs review and Needs location lists (W5)
- foundations.html: colors, type, status system, controls, states

Live canvas (editable): https://claude.ai/artifact/5EAsyy3BkyoVcuBwnXXn5c

## How to use these
- Treat them as the visual spec. Rebuild each screen as real components using app/tokens.css and docs/style-guide.md. Don't paste the markup: it uses inline styles and sample data.
- Copy exact spacing, sizes, shapes, labels and layout from the files; take colors from the tokens, not from the hex values in the markup.
- Everything shown is sample data. Real screens read through lib/data/complaints.ts, take wording from lib/i18n/strings.ts, and enforce permissions server-side.
- The map in these files is a placeholder. The real map needs a real tile source (see style-guide.md section 8).
- If the real app needs something the design doesn't show, ask the Orchestrator and update the canvas and the guide first.
- The list board shows fewer columns than the spec requires (DB-1 also needs problem, people affected, school or clinic and duration) and no spoken location. The real list keeps those columns, and staff-only lists may show the spoken location as one truncated line; public views never do (style-guide.md sections 7 and 12).
