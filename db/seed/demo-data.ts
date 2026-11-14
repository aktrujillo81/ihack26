/**
 * Demo data for `npm run db:seed:demo`: invented water points, complaints,
 * reports, notes and partners so the demo is not empty. Pure data, no database.
 *
 * - Every place, partner and staff label is invented. There are NO caller
 *   details: no names, no phone numbers, no emails. Transcripts hold only the
 *   assistant's questions and short answers about the water problem.
 * - Coordinates are demo values near each other. The real district is unknown.
 * - Scores and reasons follow docs/spec.md section 7 (the weights are
 *   configuration in the real scorer, D5; tests/unit/demo-data.test.ts checks
 *   these numbers against the spec formula so they cannot drift).
 * - Covers: every complaint status; every problem type; verified, unverified,
 *   merged and archived water points; points with and without coordinates;
 *   needs-review complaints and unmatched reports; a partner and a note.
 *
 * Times are "hours before the seed ran", so the demo looks recent.
 */
import type { Duration, LocationSource, Problem, VerificationState, WaterPointType } from "../../lib/domain/types";

export interface DemoPoint {
  key: string;
  type: WaterPointType;
  /** Spoken-style location text, as a caller would give it. */
  locationText: string;
  verification: VerificationState;
  source: LocationSource;
  lat: string | null;
  lng: string | null;
  needsReview?: boolean;
  /** The key of the point this one was merged into. */
  mergedInto?: string;
}

export interface DemoReport {
  key: string;
  /** Water point key, or null for an unmatched report. */
  point: string | null;
  /** Complaint key, or null. */
  complaint: string | null;
  type: WaterPointType;
  locationText: string;
  problem: Problem;
  people: number | null;
  school: boolean | null;
  duration: Duration;
  summary: string;
  transcript: string;
  hoursAgo: number;
  needsReview?: boolean;
}

export interface DemoComplaint {
  key: string;
  point: string;
  status: "open" | "passed_on" | "fixed";
  score: number;
  reason: string;
  needsReview?: boolean;
  /** A partner key. Passing on is a recorded step only: nothing is sent. */
  partner?: string;
  passedOnNote?: string;
  createdHoursAgo: number;
  /** Hours ago it was marked fixed. */
  fixedHoursAgo?: number;
}

export interface DemoPartner {
  key: string;
  name: string;
  type: string;
}

export const DEMO_PARTNERS: readonly DemoPartner[] = [
  { key: "repair", name: "Demo Pump Repair Co-op", type: "repair technician" },
  { key: "office", name: "Demo District Water Office", type: "local government" },
];

export const DEMO_POINTS: readonly DemoPoint[] = [
  { key: "riverside", type: "hand_pump", locationText: "Riverside village, near the market", verification: "verified", source: "map_pin", lat: "-1.292100", lng: "36.821900" },
  { key: "hilltop", type: "borehole", locationText: "Hilltop village, behind the school", verification: "verified", source: "map_pin", lat: "-1.295500", lng: "36.830200" },
  { key: "lakeside", type: "tap", locationText: "Lakeside village, next to the clinic", verification: "verified", source: "map_pin", lat: "-1.288800", lng: "36.815000" },
  { key: "eastfield", type: "well", locationText: "Eastfield village, by the big mango tree", verification: "verified", source: "map_pin", lat: "-1.301000", lng: "36.840000" },
  { key: "orchard", type: "tap", locationText: "Orchard road, at the corner shop", verification: "verified", source: "map_pin", lat: "-1.306000", lng: "36.826000" },
  { key: "quarry", type: "hand_pump", locationText: "Quarry Hill, past the water tank", verification: "verified", source: "gps", lat: "-1.312000", lng: "36.833000" },
  { key: "southgate_west", type: "tap", locationText: "Southgate village, near the school (west tap)", verification: "verified", source: "map_pin", lat: "-1.310000", lng: "36.800000" },
  { key: "southgate_east", type: "tap", locationText: "Southgate village, near the school (east tap)", verification: "verified", source: "map_pin", lat: "-1.310500", lng: "36.801000" },
  // Unverified, from a call, no coordinates: appears in "Needs location".
  { key: "stonebridge", type: "hand_pump", locationText: "Stonebridge, past the church on the dirt road", verification: "unverified", source: "landmark_only", lat: null, lng: null },
  { key: "northgate", type: "unknown", locationText: "Northgate, near the bus stop", verification: "unverified", source: "landmark_only", lat: null, lng: null, needsReview: true },
  // Unverified WITH coordinates: not shown on the public map unless that is turned on.
  { key: "dune", type: "borehole", locationText: "Dune road, beside the new houses", verification: "unverified", source: "landmark_only", lat: "-1.320000", lng: "36.850000" },
  // A duplicate that was merged, and an old point that was archived (history is never deleted).
  { key: "riverside_dup", type: "hand_pump", locationText: "Riverside, by the market stalls", verification: "merged", source: "landmark_only", lat: null, lng: null, mergedInto: "riverside" },
  { key: "oldmill", type: "well", locationText: "Old Mill village, by the ruins", verification: "archived", source: "geocoded", lat: "-1.330000", lng: "36.860000" },
];

const talk = (...lines: string[]): string => lines.join(" ");

export const DEMO_COMPLAINTS: readonly DemoComplaint[] = [
  // Open, no water, serves a school, many people, a week: the most urgent.
  { key: "c_riverside", point: "riverside", status: "open", score: 12, reason: "No water (+3), serves a school or clinic (+3), 100 or more people (+2), a week or more (+2), 2 extra reports (+2)", createdHoursAgo: 72 },
  { key: "c_hilltop", point: "hilltop", status: "open", score: 5, reason: "Broken (+3), 20 to 99 people (+1), a few days (+1)", createdHoursAgo: 30 },
  // Passed on to a partner, with a note. A recorded step only.
  { key: "c_lakeside", point: "lakeside", status: "passed_on", score: 7, reason: "Slow (+1), serves a school or clinic (+3), 20 to 99 people (+1), a few days (+1), 1 extra report (+1)", partner: "repair", passedOnNote: "Demo Pump Repair Co-op", createdHoursAgo: 60 },
  // Fixed.
  { key: "c_eastfield", point: "eastfield", status: "fixed", score: 2, reason: "Dirty (+1), 20 to 99 people (+1)", createdHoursAgo: 90, fixedHoursAgo: 20 },
  // "Other" problem.
  { key: "c_orchard", point: "orchard", status: "open", score: 1, reason: "Other problem (+1)", createdHoursAgo: 8 },
  // New, unverified, no coordinates, mostly unknown values.
  { key: "c_stonebridge", point: "stonebridge", status: "open", score: 3, reason: "Broken (+3). People affected, school or clinic and duration are unknown and add nothing", createdHoursAgo: 5 },
  // Needs review: unknown problem, caller hung up early.
  { key: "c_northgate", point: "northgate", status: "open", score: 1, reason: "Problem unknown (+1). Everything else is unknown and adds nothing", needsReview: true, createdHoursAgo: 3 },
];

export const DEMO_REPORTS: readonly DemoReport[] = [
  // Riverside: three reports about the same pump.
  { key: "r1", point: "riverside", complaint: "c_riverside", type: "hand_pump", locationText: "Riverside village near the market", problem: "no_water", people: 150, school: true, duration: "week_or_more", hoursAgo: 72,
    summary: "The hand pump near Riverside market has had no water for over a week and a school depends on it.",
    transcript: talk("Assistant: Where is the water point?", "Caller: Riverside village, near the market.", "Assistant: What is wrong?", "Caller: There is no water. It has been a week.", "Assistant: How many people use it?", "Caller: About one hundred and fifty. The school uses it too.", "Assistant: Is that right?", "Caller: Yes.") },
  { key: "r2", point: "riverside", complaint: "c_riverside", type: "hand_pump", locationText: "Riverside, by the market stalls", problem: "no_water", people: 100, school: null, duration: "few_days", hoursAgo: 40,
    summary: "No water at the Riverside hand pump for a few days.",
    transcript: talk("Assistant: Where is the water point?", "Caller: Riverside, by the market stalls.", "Assistant: What is wrong?", "Caller: No water for some days.", "Assistant: Is that right?", "Caller: Yes.") },
  { key: "r3", point: "riverside", complaint: "c_riverside", type: "hand_pump", locationText: "Riverside market pump", problem: "no_water", people: 150, school: true, duration: "week_or_more", hoursAgo: 6,
    summary: "Still no water at the Riverside market pump.",
    transcript: talk("Assistant: Where is the water point?", "Caller: The market pump at Riverside.", "Assistant: What is wrong?", "Caller: Still nothing.", "Assistant: Is that right?", "Caller: Yes.") },
  { key: "r4", point: "hilltop", complaint: "c_hilltop", type: "borehole", locationText: "Hilltop village behind the school", problem: "broken", people: 40, school: false, duration: "few_days", hoursAgo: 30,
    summary: "The Hilltop borehole is broken and has been for a few days.",
    transcript: talk("Assistant: Where is the water point?", "Caller: Hilltop village, behind the school.", "Assistant: What kind is it?", "Caller: A borehole.", "Assistant: What is wrong?", "Caller: The handle is broken.", "Assistant: Is that right?", "Caller: Yes.") },
  { key: "r5", point: "lakeside", complaint: "c_lakeside", type: "tap", locationText: "Lakeside village next to the clinic", problem: "slow", people: 25, school: true, duration: "few_days", hoursAgo: 60,
    summary: "The Lakeside tap next to the clinic runs very slowly.",
    transcript: talk("Assistant: What is wrong?", "Caller: The water comes out very slowly. The clinic uses it.", "Assistant: Is that right?", "Caller: Yes.") },
  { key: "r6", point: "lakeside", complaint: "c_lakeside", type: "tap", locationText: "Lakeside tap by the clinic", problem: "slow", people: 25, school: true, duration: "few_days", hoursAgo: 50,
    summary: "The Lakeside clinic tap is still slow.",
    transcript: talk("Assistant: What is wrong?", "Caller: It is still very slow.", "Assistant: Is that right?", "Caller: Yes.") },
  { key: "r7", point: "eastfield", complaint: "c_eastfield", type: "well", locationText: "Eastfield village by the mango tree", problem: "dirty", people: 60, school: false, duration: "today", hoursAgo: 90,
    summary: "The Eastfield well water looks dirty today.",
    transcript: talk("Assistant: What is wrong?", "Caller: The water looks dirty today.", "Assistant: Is that right?", "Caller: Yes.") },
  { key: "r8", point: "orchard", complaint: "c_orchard", type: "tap", locationText: "Orchard road corner shop", problem: "other", people: 10, school: false, duration: "today", hoursAgo: 8,
    summary: "A problem with the tap at the Orchard road corner shop.",
    transcript: talk("Assistant: What is wrong?", "Caller: Something is not right with the tap.", "Assistant: Is that right?", "Caller: Yes.") },
  { key: "r9", point: "stonebridge", complaint: "c_stonebridge", type: "hand_pump", locationText: "Stonebridge, past the church on the dirt road", problem: "broken", people: null, school: null, duration: "unknown", hoursAgo: 5,
    summary: "The hand pump past the church in Stonebridge is broken.",
    transcript: talk("Assistant: Where is it?", "Caller: Stonebridge, past the church.", "Assistant: What is wrong?", "Caller: The pump is broken. I do not know how many people use it.", "Assistant: Is that right?", "Caller: Yes.") },
  // Needs review: the caller hung up early.
  { key: "r10", point: "northgate", complaint: "c_northgate", type: "unknown", locationText: "Northgate, near the bus stop", problem: "unknown", people: null, school: null, duration: "today", hoursAgo: 3, needsReview: true,
    summary: "A water problem near the Northgate bus stop was reported but the call ended early.",
    transcript: talk("Assistant: Where is the water point?", "Caller: Northgate, near the bus stop.", "Caller: Sorry, I have to go.") },
  // Unmatched reports: stored and flagged, never dropped.
  { key: "r11", point: null, complaint: null, type: "tap", locationText: "Southgate village near the school", problem: "broken", people: 30, school: true, duration: "few_days", hoursAgo: 2, needsReview: true,
    summary: "A tap near the Southgate school is broken, but two taps match that description.",
    transcript: talk("Assistant: Where is the tap?", "Caller: Southgate village, near the school.", "Assistant: What is wrong?", "Caller: It is broken.") },
  { key: "r12", point: null, complaint: null, type: "unknown", locationText: "unknown", problem: "no_water", people: null, school: null, duration: "unknown", hoursAgo: 1, needsReview: true,
    summary: "Someone reported no water but could not describe the location.",
    transcript: talk("Assistant: Where is the water point?", "Caller: I am not sure. It is far from here.") },
  { key: "r13", point: null, complaint: null, type: "unknown", locationText: "unknown", problem: "unknown", people: null, school: null, duration: "unknown", hoursAgo: 1, needsReview: true,
    summary: "The call was not about a water problem.",
    transcript: talk("Assistant: Where is the water point?", "Caller: I wanted to ask about something else.") },
];

export const DEMO_NOTES: readonly { complaint: string; by: "responder" | "admin"; text: string; hoursAgo: number }[] = [
  { complaint: "c_lakeside", by: "responder", text: "Passed to the repair co-op. Asked them to confirm the fault.", hoursAgo: 24 },
  { complaint: "c_eastfield", by: "responder", text: "The village committee confirmed the water is clear again.", hoursAgo: 20 },
  { complaint: "c_riverside", by: "admin", text: "Checking whether the district office can look at this one first.", hoursAgo: 4 },
];
