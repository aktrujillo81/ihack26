"use client";

import { createContext, useContext, type ReactNode } from "react";

import { SampleDataTag } from "./SampleDataTag";

const SampleDataContext = createContext(false);

/**
 * Set once by the dashboard layout from a read-only check on the server
 * (`isSampleData` in lib/data/complaints.ts). The value is a yes or no and
 * nothing else; the layout is where it is read, the page headers only show it.
 */
export function SampleDataProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <SampleDataContext.Provider value={value}>{children}</SampleDataContext.Provider>;
}

/** The dashed "Sample data" tag, only while the data is invented demo data. */
export function SampleDataIndicator() {
  return useContext(SampleDataContext) ? <SampleDataTag /> : null;
}
