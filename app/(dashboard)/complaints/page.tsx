import type { Metadata } from "next";
import { Suspense } from "react";

import { ComplaintList } from "@/components/complaints/ComplaintList";
import { StateMessage } from "@/components/complaints/StateMessage";
import { requirePageSession } from "@/lib/auth/page-guard";
import { toDataContext } from "@/lib/auth/guards";
import { t } from "@/lib/i18n/strings";

export const metadata: Metadata = { title: t("nav.complaints") };

// Per-user data: never cached or shared between users.
export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  // Checked here as well as in the layout: layouts do not re-run on navigation.
  const session = await requirePageSession();
  return (
    <main>
      <h1>{t("nav.complaints")}</h1>
      <Suspense fallback={<StateMessage state={{ status: "loading" }} emptyKey="list.empty" />}>
        <ComplaintList ctx={toDataContext(session)} retryHref="/complaints" />
      </Suspense>
    </main>
  );
}
