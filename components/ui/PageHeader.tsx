import type { ReactNode } from "react";

import "./ui.css";

/**
 * The page header pattern: the title (tracking -0.015em, 600) and a one-line
 * description on the left, and an optional slot on the right for status items
 * such as the Sample data tag, a live indicator or the last-report card. Those
 * items are passed in by a page only when it has a real source for them; this
 * component never invents one. `title` and `subtitle` are already-translated text.
 */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="ww-page-header">
      <div>
        <h1 className="ww-page-title">{title}</h1>
        {subtitle && <p className="ww-page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="ww-page-header-aside">{children}</div>}
    </header>
  );
}
