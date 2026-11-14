/**
 * Builds fake validated reports at runtime for D3b tests. Nothing here is a
 * real person or number, and no phone number or name is written as literal
 * text: digits are drawn at random and names are joined from pieces (docs/tasks/D3b.md,
 * rule 7). Never paste a real number into a test or fixture.
 */
import { randomInt, randomUUID } from "node:crypto";

import type { ValidatedReport } from "@/lib/ingest/types";

function digits(count: number): string {
  let out = "";
  for (let i = 0; i < count; i += 1) out += String(randomInt(0, 10));
  return out;
}

/** Random fake phone numbers in several formats. Each has 7 or more digits. */
export function fakePhoneNumbers(): string[] {
  const a = digits(3);
  const b = digits(3);
  const c = digits(4);
  return [
    `${a}${b}${c}`, // bare digits
    `${a}-${b}-${c}`, // hyphens
    `${a}.${b}.${c}`, // dots
    `${a} ${b} ${c}`, // spaces
    `(${a}) ${b}-${c}`, // brackets
    `+${digits(2)} ${a} ${b} ${c}`, // leading plus, country code
    `+${digits(2)}-${a}-${b}-${c}`, // plus and hyphens
  ];
}

/** A fake name joined from pieces so the full name is never in the source. */
export function fakeName(): string {
  const firstPieces = [["Zo", "ra"], ["Kel", "mu"], ["Tab", "ino"]][randomInt(0, 3)];
  const lastPieces = [["Quen", "dar"], ["Mor", "vik"], ["Sal", "ume"]][randomInt(0, 3)];
  return `${firstPieces.join("")} ${lastPieces.join("")}`;
}

/**
 * A fake provider call ref (stands in for D3a's HMAC). Letters only, so a
 * "7 or more digits" check never trips on it by chance. Different from any raw ID.
 */
export function fakeCallRef(): string {
  let out = "";
  for (let i = 0; i < 64; i += 1) out += String.fromCharCode(97 + randomInt(0, 26));
  return out;
}

/** A clean, normal report: valid, confirmed, no review. Fresh scope ids each call. */
export function buildFakeReport(overrides: Partial<ValidatedReport> = {}): ValidatedReport {
  return {
    organizationId: randomUUID(),
    regionId: randomUUID(),
    providerCallRef: fakeCallRef(),
    channel: "phone",
    locationText: "Riverside Village near the market",
    waterPointType: "hand_pump",
    problem: "no_water",
    peopleAffected: 150,
    servesSchoolOrClinic: true,
    duration: "week_or_more",
    callerConfirmed: true,
    summary: "The hand pump in Riverside Village near the market has no water.",
    languageSpoken: "English",
    transcript: null,
    endedReason: "assistant-said-end-call-phrase",
    needsReview: false,
    needsReviewReason: null,
    ...overrides,
  };
}

export interface PlantedPersonalData {
  phones: string[];
  name: string;
}

/**
 * Puts fake phone numbers and a fake name into the three free-text fields, to
 * test that nothing personal is stored. D3a should have scrubbed these before
 * the report reaches D3b, so this simulates a scrub that failed.
 */
export function plantPersonalData(report: ValidatedReport): { report: ValidatedReport; planted: PlantedPersonalData } {
  const phones = fakePhoneNumbers();
  const name = fakeName();
  return {
    planted: { phones, name },
    report: {
      ...report,
      locationText: `${report.locationText}, call ${phones[0]} or ${phones[1]}`,
      summary: `${report.summary} Ask for ${name}: ${phones[2]}, ${phones[3]}, ${phones[4]}.`,
      languageSpoken: report.languageSpoken === null ? null : `${report.languageSpoken} ${phones[5]} ${phones[6]}`,
    },
  };
}
