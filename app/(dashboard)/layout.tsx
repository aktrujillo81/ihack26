import { AppNav } from "@/components/nav/AppNav";
import { requirePageSession } from "@/lib/auth/page-guard";

/**
 * The protected shell: header with role-aware navigation and sign-out. It checks
 * the session, but a layout does not run again when a user moves between pages,
 * so EVERY page below this layout also calls `requirePageSession()` itself.
 */
export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requirePageSession();
  return (
    <>
      <AppNav role={session.role} />
      <div className="ww-page">{children}</div>
    </>
  );
}
