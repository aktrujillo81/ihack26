import type { Metadata } from "next";
import { Suspense } from "react";

import { NeedsReviewList } from "@/components/complaints/NeedsReviewList";
import { StateMessage } from "@/components/complaints/StateMessage";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/auth/page-guard";
import { toDataContext } from "@/lib/auth/guards";
import { t } from "@/lib/i18n/strings";

export const metadata: Metadata = { title: t("nav.needsReview") };

// Per-user data: never cached or shared between users.
export const dynamic = "force-dynamic";

/** Read-only list of reports the system could not match (W5, smallest version). No actions. */
export default async function NeedsReviewPage() {
  // Checked here as well as in the layout: layouts do not re-run on navigation.
  const session = await requirePageSession();
  return (
    <main>
      <PageHeader title={t("nav.needsReview")} subtitle={t("page.needsReview.subtitle")} />
      <Suspense fallback={<StateMessage state={{ status: "loading" }} emptyKey="needsReview.empty" />}>
        <NeedsReviewList ctx={toDataContext(session)} retryHref="/needs-review" />
      </Suspense>
    </main>
  );
}
