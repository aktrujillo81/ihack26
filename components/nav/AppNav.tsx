import { ROLES, type Role } from "@/lib/domain/types";
import { t } from "@/lib/i18n/strings";
import { navItemsFor } from "@/lib/permissions/routes";

import "./nav.css";
import { NavLinks } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";

const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);

/**
 * The left navigation rail: brand, the links this role may use, and the user
 * block with sign-out. The links come from the same rules that guard the routes
 * (lib/permissions), and hiding one is only a convenience: every page checks the
 * session itself. `role` comes from the validated server session, never from the
 * client.
 *
 * Only routes that exist are linked. There is no Administration group, and no
 * Needs review or Needs location link, until those pages exist (W5 and later);
 * count badges come with them, from real data. Nothing here is a hard-coded number.
 */
export function AppNav({ role }: { role: unknown }) {
  const items = navItemsFor(role);
  const roleLabel = isRole(role) ? t(`role.${role}`) : null;
  return (
    <nav className="ww-rail" aria-label={t("app.name")}>
      <div className="ww-brand">
        <div className="ww-brand-tile" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            <path d="M12 3c3.5 4.2 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-5.8 6-10z" />
            <path d="M9.5 14a2.6 2.6 0 0 0 2.5 2.2" />
          </svg>
        </div>
        <div>
          <div className="ww-brand-name">{t("app.name")}</div>
          <div className="ww-brand-sub">{t("app.subtitle")}</div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="ww-nav-group">
          <div className="ww-nav-group-label">{t("nav.workspace")}</div>
          <NavLinks items={items} />
        </div>
      )}

      <div className="ww-user">
        {roleLabel !== null && (
          <>
            <div className="ww-avatar" aria-hidden="true">
              {roleLabel.charAt(0).toUpperCase()}
            </div>
            <div className="ww-user-text">
              <div className="ww-user-label">{t("nav.signedInAs")}</div>
              <div className="ww-user-role">{roleLabel}</div>
            </div>
          </>
        )}
        <SignOutButton />
      </div>
    </nav>
  );
}
