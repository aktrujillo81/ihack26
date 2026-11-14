/**
 * Settings for the TEMPORARY Vapi capture route (task S5a).
 * Remove this file together with the route when D3 lands.
 */
export const vapiCaptureConfig = {
  /** Folder for raw call bodies, relative to the app's working directory. Gitignored. */
  directory: "docs/samples/raw",
  /** Bodies larger than this are refused with 413. */
  maxBodyBytes: 2 * 1024 * 1024,
  /** After this many saved files, nothing more is saved, so the disk cannot be filled. */
  maxFiles: 20,
} as const;
