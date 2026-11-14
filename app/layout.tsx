import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { t } from "@/lib/i18n/strings";
import "./tokens.css";
import "@/components/ui/ui.css";
import "./globals.css";

// Self-hosted by next/font at build time (no link tag, no request to Google from the browser).
// tokens.css points --ww-font-sans and --ww-font-mono at these variables.
const plexSans = IBM_Plex_Sans({ weight: ["400", "500", "600"], subsets: ["latin"], display: "swap", variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], display: "swap", variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
