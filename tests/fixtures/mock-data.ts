/**
 * PROVISIONAL mock data. Replace with real data through the data layer once the
 * database and docs/contracts.md exist.
 *
 * All places, partners and people are invented. There are no caller details:
 * no names, no phone numbers. Transcripts are invented and contain none.
 *
 * Coverage: every complaint status, every problem value, unverified and
 * needs-location water points, an ambiguous match, an unusable location, a
 * merged and an archived water point, and `unknown` values.
 */
import type { Complaint, HistoryEvent, LastReportReceived, Note, Partner, Report, WaterPoint } from "@/lib/domain/types";

const org = "org-demo";
const region = "region-demo";
const scope = { organizationId: org, regionId: region } as const;

export const mockPartners: Partner[] = [
  { id: "partner-1", ...scope, name: "Demo Pump Repair Co-op", type: "repair technician", contact: null },
  { id: "partner-2", ...scope, name: "Demo District Water Office", type: "local government", contact: null },
  { id: "partner-3", ...scope, name: "Demo Village Water Committee", type: "water committee", contact: null },
];

export const mockWaterPoints: WaterPoint[] = [
  {
    id: "wp-1", ...scope, type: "hand_pump", locationText: "Riverside village, near the market",
    latitude: -1.2921, longitude: 36.8219, locationSource: "map_pin", verificationState: "verified",
    mergedIntoId: null, createdAt: "2026-11-10T08:00:00Z", updatedAt: "2026-11-10T08:00:00Z",
  },
  {
    id: "wp-2", ...scope, type: "borehole", locationText: "Hilltop village, behind the school",
    latitude: -1.2955, longitude: 36.8302, locationSource: "map_pin", verificationState: "verified",
    mergedIntoId: null, createdAt: "2026-11-10T08:00:00Z", updatedAt: "2026-11-10T08:00:00Z",
  },
  {
    id: "wp-3", ...scope, type: "tap", locationText: "Lakeside village, next to the clinic",
    latitude: -1.2888, longitude: 36.8150, locationSource: "map_pin", verificationState: "verified",
    mergedIntoId: null, createdAt: "2026-11-10T08:00:00Z", updatedAt: "2026-11-12T09:30:00Z",
  },
  {
    id: "wp-4", ...scope, type: "well", locationText: "Eastfield village, by the big mango tree",
    latitude: -1.3010, longitude: 36.8400, locationSource: "map_pin", verificationState: "verified",
    mergedIntoId: null, createdAt: "2026-11-10T08:00:00Z", updatedAt: "2026-11-10T08:00:00Z",
  },
  // Unverified, created from a call, no coordinates: appears in "Needs location".
  {
    id: "wp-5", ...scope, type: "hand_pump", locationText: "Stonebridge, past the church on the dirt road",
    latitude: null, longitude: null, locationSource: "landmark_only", verificationState: "unverified",
    mergedIntoId: null, createdAt: "2026-11-13T10:15:00Z", updatedAt: "2026-11-13T10:15:00Z",
  },
  // Unverified with unknown type.
  {
    id: "wp-6", ...scope, type: "unknown", locationText: "Northgate, near the bus stop",
    latitude: null, longitude: null, locationSource: "landmark_only", verificationState: "unverified",
    mergedIntoId: null, createdAt: "2026-11-13T11:40:00Z", updatedAt: "2026-11-13T11:40:00Z",
  },
  // Two points an ambiguous report could refer to.
  {
    id: "wp-7", ...scope, type: "tap", locationText: "Southgate village, near the school (west tap)",
    latitude: -1.3100, longitude: 36.8000, locationSource: "map_pin", verificationState: "verified",
    mergedIntoId: null, createdAt: "2026-11-10T08:00:00Z", updatedAt: "2026-11-10T08:00:00Z",
  },
  {
    id: "wp-8", ...scope, type: "tap", locationText: "Southgate village, near the school (east tap)",
    latitude: -1.3105, longitude: 36.8010, locationSource: "map_pin", verificationState: "verified",
    mergedIntoId: null, createdAt: "2026-11-10T08:00:00Z", updatedAt: "2026-11-10T08:00:00Z",
  },
  // Merged duplicate: the old ID points to the survivor (wp-1).
  {
    id: "wp-9", ...scope, type: "hand_pump", locationText: "Riverside, by the market stalls",
    latitude: null, longitude: null, locationSource: "landmark_only", verificationState: "merged",
    mergedIntoId: "wp-1", createdAt: "2026-11-11T09:00:00Z", updatedAt: "2026-11-12T08:00:00Z",
  },
  // Archived (never deleted).
  {
    id: "wp-10", ...scope, type: "well", locationText: "Old Mill village, by the ruins",
    latitude: -1.3200, longitude: 36.8500, locationSource: "geocoded", verificationState: "archived",
    mergedIntoId: null, createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-11-01T08:00:00Z",
  },
];

export const mockComplaints: Complaint[] = [
  // Open, red: no_water, school served, many people, long duration, multiple reports.
  {
    id: "c-1", ...scope, waterPointId: "wp-1", status: "open", problem: "no_water", peopleAffected: 150,
    servesSchoolOrClinic: true, duration: "week_or_more", reportCount: 3, priorityScore: 12,
    scoreReason: "No water (+3), serves a school or clinic (+3), 100 or more people (+2), a week or more (+2), 2 extra reports (+2)",
    needsReview: false, needsReviewReason: null, passedOnPartnerId: null, passedOnNote: null, version: "v1",
    createdAt: "2026-11-11T07:00:00Z", updatedAt: "2026-11-13T07:00:00Z",
  },
  // Open, red: broken.
  {
    id: "c-2", ...scope, waterPointId: "wp-2", status: "open", problem: "broken", peopleAffected: 40,
    servesSchoolOrClinic: false, duration: "few_days", reportCount: 1, priorityScore: 5,
    scoreReason: "Broken (+3), 20 to 99 people (+1), a few days (+1)",
    needsReview: false, needsReviewReason: null, passedOnPartnerId: null, passedOnNote: null, version: "v1",
    createdAt: "2026-11-12T12:00:00Z", updatedAt: "2026-11-12T12:00:00Z",
  },
  // Passed on, yellow: slow.
  {
    id: "c-3", ...scope, waterPointId: "wp-3", status: "passed_on", problem: "slow", peopleAffected: 25,
    servesSchoolOrClinic: true, duration: "few_days", reportCount: 2, priorityScore: 7,
    scoreReason: "Slow (+1), serves a school or clinic (+3), 20 to 99 people (+1), a few days (+1), 1 extra report (+1)",
    needsReview: false, needsReviewReason: null, passedOnPartnerId: "partner-1", passedOnNote: null, version: "v1",
    createdAt: "2026-11-10T14:00:00Z", updatedAt: "2026-11-13T09:00:00Z",
  },
  // Fixed, green: dirty.
  {
    id: "c-4", ...scope, waterPointId: "wp-4", status: "fixed", problem: "dirty", peopleAffected: 60,
    servesSchoolOrClinic: false, duration: "today", reportCount: 1, priorityScore: 2,
    scoreReason: "Dirty (+1), 20 to 99 people (+1)",
    needsReview: false, needsReviewReason: null, passedOnPartnerId: "partner-3", passedOnNote: null, version: "v1",
    createdAt: "2026-11-09T10:00:00Z", updatedAt: "2026-11-12T16:00:00Z",
  },
  // Open on an unverified, needs-location water point.
  {
    id: "c-5", ...scope, waterPointId: "wp-5", status: "open", problem: "broken", peopleAffected: "unknown",
    servesSchoolOrClinic: "unknown", duration: "unknown", reportCount: 1, priorityScore: 3,
    scoreReason: "Broken (+3). People affected, school or clinic and duration are unknown and add nothing",
    needsReview: false, needsReviewReason: null, passedOnPartnerId: null, passedOnNote: null, version: "v1",
    createdAt: "2026-11-13T10:15:00Z", updatedAt: "2026-11-13T10:15:00Z",
  },
  // Unknown problem on an unverified point: yellow, never severe.
  {
    id: "c-6", ...scope, waterPointId: "wp-6", status: "open", problem: "unknown", peopleAffected: "unknown",
    servesSchoolOrClinic: "unknown", duration: "today", reportCount: 1, priorityScore: 1,
    scoreReason: "Problem unknown (+1). Everything else unknown and adds nothing",
    needsReview: true, needsReviewReason: "invalid_fields", passedOnPartnerId: null, passedOnNote: null, version: "v1",
    createdAt: "2026-11-13T11:40:00Z", updatedAt: "2026-11-13T11:40:00Z",
  },
  // Open, "other" problem.
  {
    id: "c-7", ...scope, waterPointId: "wp-2", status: "open", problem: "other", peopleAffected: 10,
    servesSchoolOrClinic: false, duration: "today", reportCount: 1, priorityScore: 1,
    scoreReason: "Other problem (+1)",
    needsReview: false, needsReviewReason: null, passedOnPartnerId: null, passedOnNote: null, version: "v1",
    createdAt: "2026-11-13T13:00:00Z", updatedAt: "2026-11-13T13:00:00Z",
  },
];

export const mockReports: Report[] = [
  {
    id: "r-1", ...scope, channel: "phone", waterPointId: "wp-1", complaintId: "c-1",
    locationText: "Riverside village near the market", waterPointType: "hand_pump", problem: "no_water",
    peopleAffected: 150, servesSchoolOrClinic: true, duration: "week_or_more", callerConfirmed: true,
    summary: "The hand pump near Riverside market has had no water for over a week and a school depends on it.",
    languageSpoken: "English",
    transcript: "Assistant: Where is the water point? Caller: Riverside village, near the market. Assistant: What is wrong? Caller: There is no water. It has been a week. A school uses it.",
    needsReview: false, needsReviewReason: null, candidateWaterPointIds: [], receivedAt: "2026-11-11T07:00:00Z",
  },
  {
    id: "r-2", ...scope, channel: "phone", waterPointId: "wp-1", complaintId: "c-1",
    locationText: "Riverside, by the market stalls", waterPointType: "hand_pump", problem: "no_water",
    peopleAffected: 100, servesSchoolOrClinic: "unknown", duration: "few_days", callerConfirmed: true,
    summary: "No water at the Riverside hand pump for a few days.",
    languageSpoken: "English",
    transcript: "Assistant: Where is the water point? Caller: Riverside, by the market stalls. Assistant: What is wrong? Caller: No water for some days.",
    needsReview: false, needsReviewReason: null, candidateWaterPointIds: [], receivedAt: "2026-11-12T09:00:00Z",
  },
  {
    id: "r-3", ...scope, channel: "phone", waterPointId: "wp-1", complaintId: "c-1",
    locationText: "Riverside market pump", waterPointType: "hand_pump", problem: "no_water",
    peopleAffected: 150, servesSchoolOrClinic: true, duration: "week_or_more", callerConfirmed: true,
    summary: "Still no water at the Riverside market pump.",
    languageSpoken: "English", transcript: null, // empty-transcript case
    needsReview: false, needsReviewReason: null, candidateWaterPointIds: [], receivedAt: "2026-11-13T07:00:00Z",
  },
  {
    id: "r-4", ...scope, channel: "phone", waterPointId: "wp-5", complaintId: "c-5",
    locationText: "Stonebridge, past the church on the dirt road", waterPointType: "hand_pump", problem: "broken",
    peopleAffected: "unknown", servesSchoolOrClinic: "unknown", duration: "unknown", callerConfirmed: true,
    summary: "The hand pump past the church in Stonebridge is broken.",
    languageSpoken: "English",
    transcript: "Assistant: Where is it? Caller: Stonebridge, past the church. Assistant: What is wrong? Caller: The pump is broken. I don't know how many people.",
    needsReview: false, needsReviewReason: null, candidateWaterPointIds: [], receivedAt: "2026-11-13T10:15:00Z",
  },
  // Incomplete: hung up early.
  {
    id: "r-5", ...scope, channel: "phone", waterPointId: "wp-6", complaintId: "c-6",
    locationText: "Northgate, near the bus stop", waterPointType: "unknown", problem: "unknown",
    peopleAffected: "unknown", servesSchoolOrClinic: "unknown", duration: "today", callerConfirmed: false,
    summary: "Caller reported a water problem near the Northgate bus stop but ended the call early.",
    languageSpoken: "English", transcript: "Assistant: Where is the water point? Caller: Northgate, near the bus stop. Caller: Sorry, I have to go.",
    needsReview: true, needsReviewReason: "invalid_fields", candidateWaterPointIds: [], receivedAt: "2026-11-13T11:40:00Z",
  },
  // Ambiguous: several water points fit, none chosen.
  {
    id: "r-6", ...scope, channel: "phone", waterPointId: null, complaintId: null,
    locationText: "Southgate village near the school", waterPointType: "tap", problem: "broken",
    peopleAffected: 30, servesSchoolOrClinic: true, duration: "few_days", callerConfirmed: true,
    summary: "A tap near the Southgate school is broken, but two taps match that description.",
    languageSpoken: "English", transcript: "Assistant: Where is the tap? Caller: Southgate village, near the school. Assistant: What is wrong? Caller: It is broken.",
    needsReview: true, needsReviewReason: "ambiguous_match", candidateWaterPointIds: ["wp-7", "wp-8"], receivedAt: "2026-11-13T12:20:00Z",
  },
  // Unusable location.
  {
    id: "r-7", ...scope, channel: "phone", waterPointId: null, complaintId: null,
    locationText: "unknown", waterPointType: "unknown", problem: "no_water",
    peopleAffected: "unknown", servesSchoolOrClinic: "unknown", duration: "unknown", callerConfirmed: false,
    summary: "Caller reported no water but could not describe the location.",
    languageSpoken: "unknown", transcript: "Assistant: Where is the water point? Caller: I am not sure. It is far from here.",
    needsReview: true, needsReviewReason: "unusable_location", candidateWaterPointIds: [], receivedAt: "2026-11-13T14:00:00Z",
  },
  // Off topic.
  {
    id: "r-8", ...scope, channel: "phone", waterPointId: null, complaintId: null,
    locationText: "unknown", waterPointType: "unknown", problem: "unknown",
    peopleAffected: "unknown", servesSchoolOrClinic: "unknown", duration: "unknown", callerConfirmed: false,
    summary: "The call was not about a water problem.",
    languageSpoken: "English", transcript: "Assistant: Where is the water point? Caller: I wanted to ask about something else.",
    needsReview: true, needsReviewReason: "no_structured_data", candidateWaterPointIds: [], receivedAt: "2026-11-13T14:30:00Z",
  },
  {
    id: "r-9", ...scope, channel: "phone", waterPointId: "wp-3", complaintId: "c-3",
    locationText: "Lakeside village, next to the clinic", waterPointType: "tap", problem: "slow",
    peopleAffected: 25, servesSchoolOrClinic: true, duration: "few_days", callerConfirmed: true,
    summary: "The Lakeside tap next to the clinic runs very slowly.",
    languageSpoken: "English", transcript: "Assistant: What is wrong? Caller: The water comes out very slowly. The clinic uses it.",
    needsReview: false, needsReviewReason: null, candidateWaterPointIds: [], receivedAt: "2026-11-10T14:00:00Z",
  },
];

export const mockNotes: Note[] = [
  { id: "n-1", ...scope, complaintId: "c-3", author: "Demo Responder", text: "Passed to the repair co-op. Asked them to confirm the fault.", createdAt: "2026-11-13T09:00:00Z" },
  { id: "n-2", ...scope, complaintId: "c-4", author: "Demo Responder", text: "Partner confirmed the fix by phone with the village committee.", createdAt: "2026-11-12T16:00:00Z" },
];

export const mockHistoryEvents: HistoryEvent[] = [
  { id: "h-1", ...scope, complaintId: "c-1", waterPointId: "wp-1", type: "created", actor: null, before: null, after: { status: "open" }, note: null, at: "2026-11-11T07:00:00Z" },
  { id: "h-2", ...scope, complaintId: "c-1", waterPointId: "wp-1", type: "report_added", actor: null, before: { reportCount: 1 }, after: { reportCount: 2 }, note: null, at: "2026-11-12T09:00:00Z" },
  { id: "h-3", ...scope, complaintId: "c-1", waterPointId: "wp-1", type: "report_added", actor: null, before: { reportCount: 2 }, after: { reportCount: 3 }, note: null, at: "2026-11-13T07:00:00Z" },
  { id: "h-4", ...scope, complaintId: "c-3", waterPointId: "wp-3", type: "created", actor: null, before: null, after: { status: "open" }, note: null, at: "2026-11-10T14:00:00Z" },
  { id: "h-5", ...scope, complaintId: "c-3", waterPointId: "wp-3", type: "passed_on", actor: "Demo Responder", before: { status: "open" }, after: { status: "passed_on", passedOnNote: "Demo Pump Repair Co-op" }, note: null, at: "2026-11-13T09:00:00Z" },
  { id: "h-6", ...scope, complaintId: "c-4", waterPointId: "wp-4", type: "created", actor: null, before: null, after: { status: "open" }, note: null, at: "2026-11-09T10:00:00Z" },
  { id: "h-7", ...scope, complaintId: "c-4", waterPointId: "wp-4", type: "status_changed", actor: "Demo Responder", before: { status: "open" }, after: { status: "fixed" }, note: null, at: "2026-11-12T16:00:00Z" },
  { id: "h-8", ...scope, complaintId: null, waterPointId: "wp-9", type: "merged", actor: "Demo Responder", before: null, after: { mergedIntoId: "wp-1" }, note: null, at: "2026-11-12T08:00:00Z" },
];

export const mockLastReportReceived: LastReportReceived = { receivedAt: "2026-11-13T14:30:00Z" };
