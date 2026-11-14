import Link from "next/link";

import { signOutAction } from "@/lib/auth/sign-out";
import { t } from "@/lib/i18n/strings";
import { navItemsFor } from "@/lib/permissions/routes";

import "./nav.css";

/**
 * The page header: app name, the links this role may use, and sign-out. The
 * links come from the same rules that guard the routes (lib/permissions), and
 * hiding one is only a convenience: every page checks the session itself.
 * `role` comes from the validated server session, never from the client.
 */
export function AppNav({ role }: { role: unknown }) {
  const items = navItemsFor(role);
  return (
    <header className="ww-header">
      <span className="ww-app-name">{t("app.name")}</span>
      <nav aria-label={t("app.name")}>
        <ul className="ww-nav-list">
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{t(item.labelKey)}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action={signOutAction}>
        <button type="submit" className="ww-signout">
          {t("nav.signOut")}
        </button>
      </form>
    </header>
  );
}
