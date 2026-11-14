import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getOptionalSession } from "@/lib/auth/page-guard";
import { t } from "@/lib/i18n/strings";

import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: t("signIn.title") };

// Depends on who is asking: never cached.
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
  // Already signed in: go to the list. The destination is fixed.
  if (await getOptionalSession()) redirect("/complaints");
  const { reason } = await searchParams;
  return <SignInForm expired={reason === "expired"} />;
}
