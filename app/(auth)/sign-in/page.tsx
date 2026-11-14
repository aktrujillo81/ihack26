import type { Metadata } from "next";

import { t } from "@/lib/i18n/strings";

import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: t("signIn.title") };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
  const { reason } = await searchParams;
  return <SignInForm expired={reason === "expired"} />;
}
