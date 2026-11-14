import { AppNav } from "@/components/nav/AppNav";
import { SampleDataProvider } from "@/components/ui/SampleDataContext";
import { requirePageSession } from "@/lib/auth/page-guard";
import { toDataContext } from "@/lib/auth/guards";
import { isSampleData } from "@/lib/data/complaints";

/**
 * The protected shell: the left navigation rail (role-aware links, user block,
 * sign-out) and the content area. It checks the session, but a layout does not
 * run again when a user moves between pages, so EVERY page below this layout
 * also calls `requirePageSession()` itself.
 *
 * It also makes one small read-only check, scoped to the session's organization
 * and regions: is this invented demo data? The answer (yes or no) only decides
 * whether the page headers show the "Sample data" tag.
 */
export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requirePageSession();
  const sampleData = await isSampleData(toDataContext(session));
  return (
    <div className="ww-shell">
      <AppNav role={session.role} />
      <SampleDataProvider value={sampleData}>
        <div className="ww-content">{children}</div>
      </SampleDataProvider>
    </div>
  );
}
