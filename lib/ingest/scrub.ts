/** Shared caller-number scrub used at every ingest boundary. */
export const NUMBER_REMOVED_MARKER = "[number removed]";

const SEPARATOR = String.raw`[\s ​-‍⁠﻿.\-‐-―()\[\]]`;
const NUMBER_RUN = new RegExp(String.raw`[+(\[]?\p{Nd}(?:${SEPARATOR}*\p{Nd}){6,}`, "gu");

/** Replace runs of seven or more digits, including separated digits. */
export function scrubNumbers(text: string): string {
  return text.replace(NUMBER_RUN, NUMBER_REMOVED_MARKER);
}
