import type { Metadata } from "next";
import { Suspense } from "react";

import { ComplaintDetail } from "@/components/complaints/ComplaintDetail";
import { StateMessage } from "@/components/complaints/StateMessage";
import { toDataContext } from "@/lib/auth/guards";
import { requirePageSession } from "@/lib/auth/page-guard";
import { t } from "@/lib/i18n/strings";

export const metadata: Metadata = { title: t("nav.complaints") };

// Per-user data: never cached or shared between users.
export const dynamic = "force-dynamic";

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Checked here as well as in the layout: layouts do not re-run on navigation.
  const session = await requirePageSession();
  // The id comes from the URL and is untrusted. The data layer answers an unknown id and another
  // organization's id identically. `role` is from the validated session, never from the URL.
  const { id } = await params;
  return (
    <main>
      <Suspense fallback={<StateMessage state={{ status: "loading" }} emptyKey="detail.notFoundOrDenied" />}>
        <ComplaintDetail ctx={toDataContext(session)} role={session.role} id={id} />
      </Suspense>
    </main>
  );
}
