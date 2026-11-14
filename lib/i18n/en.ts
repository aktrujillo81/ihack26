/**
 * All user-facing text lives here so it can be translated later.
 * Do not hard-code strings in components.
 */
export const en = {
  appName: "Well Watch",
  tagline: "Water point reports from a phone call, for NGO coordinators.",
  home: {
    heading: "Well Watch",
    body: "The coordinator web app is being built. Sign-in, complaints, and the map are coming next.",
  },
} as const;

export type Messages = typeof en;
