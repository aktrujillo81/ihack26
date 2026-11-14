import { listComplaints, type DataContext } from "@/lib/data/complaints";

import { ComplaintListView } from "./ComplaintListView";

/**
 * Server component for the complaint list. The route passes the user's
 * `DataContext`, built from the verified session. This component reads no
 * session, builds no user, and reads only through lib/data/complaints.ts.
 * Wrap it in Suspense with `<StateMessage state={{ status: "loading" }} ... />`
 * as the fallback.
 */
export async function ComplaintList({ ctx, retryHref }: { ctx: DataContext; retryHref?: string }) {
  return <ComplaintListView result={await listComplaints(ctx)} retryHref={retryHref} />;
}
