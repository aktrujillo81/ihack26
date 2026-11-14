import { getComplaint, type DataContext } from "@/lib/data/complaints";

import { ComplaintDetailView } from "./ComplaintDetailView";

/**
 * Server component for one complaint. The route passes the user's `DataContext`
 * and `role`, both from the verified server session (never from the client or
 * the URL). The id comes from the URL and is untrusted: the data layer
 * answers an unknown id and another organization's id identically. This
 * component reads no session and reads only through lib/data/complaints.ts.
 */
export async function ComplaintDetail({
  ctx,
  role,
  id,
  retryHref,
}: {
  ctx: DataContext;
  role: unknown;
  id: string;
  retryHref?: string;
}) {
  return <ComplaintDetailView result={await getComplaint(ctx, id)} role={role} retryHref={retryHref} />;
}
