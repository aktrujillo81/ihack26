import type { Metadata } from "next";

import { t } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: t.appName,
  description: t.tagline,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
