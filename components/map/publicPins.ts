/**
 * Turns the public data shape into map pins. Input is `PublicPin` only, so
 * nothing but status, type, position and the unverified flag can reach the
 * page. Every pin still has a shape and a text label (red line 11).
 *
 * DECISION (differs from spec section 7, confirm): in the public view the color
 * follows the STATUS only, because the spec's color rule uses the problem
 * (no water, broken, slow...), and the problem must not be public.
 *   open = red circle, passed on = yellow diamond,
 *   fixed = green check, no open complaint = green square.
 */
import type { PublicPin, PublicStatus } from "@/lib/data/complaints";
import type { PlainKey } from "@/lib/i18n/strings";

import type { MapPin, PinColor, PinShape } from "./pins";

const LOOK: Record<PublicStatus, { shape: PinShape; color: PinColor; statusKey: PlainKey }> = {
  open: { shape: "circle", color: "red", statusKey: "status.open" },
  passed_on: { shape: "diamond", color: "yellow", statusKey: "status.passed_on" },
  fixed: { shape: "check", color: "green", statusKey: "status.fixed" },
  none: { shape: "square", color: "green", statusKey: "map.noOpenComplaint" },
};

export function toPublicMapPins(pins: readonly PublicPin[]): MapPin[] {
  return pins.map((pin) => ({
    id: pin.key,
    lat: pin.latitude,
    lng: pin.longitude,
    ...LOOK[pin.status],
    title: `type.${pin.type}`,
    problem: null,
    unverified: pin.unverified,
    needsReview: false,
    reportCount: 0,
    complaintId: null,
    locationText: null,
  }));
}
