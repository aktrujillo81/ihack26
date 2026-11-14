import type { ComponentPropsWithoutRef, ElementType } from "react";

import "./ui.css";

type PanelProps<T extends ElementType> = {
  /** The element to render: "section" (default), "div", "article"... */
  as?: T;
  /** 20px inner padding (default true). Use false for tables and maps that run edge to edge. */
  padded?: boolean;
  /** The smaller tile radius, for summary tiles. */
  tile?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

/** A card: white, 1px divider border, card shadow (the only shadow allowed), radius 12. */
export function Panel<T extends ElementType = "section">({ as, padded = true, tile = false, className, ...rest }: PanelProps<T>) {
  const Component: ElementType = as ?? "section";
  const classes = ["ww-panel", padded ? "ww-panel--padded" : "", tile ? "ww-panel--tile" : "", className ?? ""].filter(Boolean).join(" ");
  return <Component className={classes} {...rest} />;
}
