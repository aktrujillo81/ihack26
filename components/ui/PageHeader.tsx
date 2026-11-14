import type { ReactNode } from "react";

import "./ui.css";
import { SampleDataIndicator } from "./SampleDataContext";

/**
 * The page header pattern: the title (tracking -0.015em, 600) and a one-line
 * description on the left; on the right the "Sample data" tag while the data is
 * invented demo data (set once by the dashboard layout), then any slot items a
 * page passes in (a live indicator, the last-report card). A page passes those
 * only when it has a real source for them; this component never invents one.
 * `title` and `subtitle` are already-translated text.
 */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="ww-page-header">
      <div>
        <h1 className="ww-page-title">{title}</h1>
        {subtitle && <p className="ww-page-subtitle">{subtitle}</p>}
      </div>
      <div className="ww-page-header-aside">
        <SampleDataIndicator />
        {children}
      </div>
    </header>
  );
}
