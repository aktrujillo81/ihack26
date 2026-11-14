"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { t, type PlainKey } from "@/lib/i18n/strings";

import "./nav.css";

export interface NavLinkItem {
  href: string;
  labelKey: PlainKey;
}

/** Icons by route (design: operations-console). A route with no icon here shows none. */
const ICONS: Record<string, string> = {
  "/complaints": "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  "/dashboard/map": "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
};

/** A page is current when the path is the link or below it (a complaint's detail page keeps Complaints lit). */
function isCurrent(pathname: string | null, href: string): boolean {
  return pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
}

/**
 * The navigation links. This only marks the current page (`aria-current`) and
 * draws icons; WHICH links appear is decided on the server from the role
 * (lib/permissions/routes.ts), and every page still checks the session itself.
 */
export function NavLinks({ items }: { items: readonly NavLinkItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="ww-nav-list">
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="ww-nav-link" aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
            {ICONS[item.href] && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d={ICONS[item.href]} />
              </svg>
            )}
            <span>{t(item.labelKey)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
