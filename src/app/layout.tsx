import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";

import { Providers } from "./providers";
import { getDefaultOrganization } from "@/lib/supabase/queries";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DEED — Real Estate Advisor Platform",
    template: "%s · DEED",
  },
  description:
    "A calm, structured workspace for real estate transactions — for advisors and their clients.",
  applicationName: "DEED",
  openGraph: {
    title: "DEED — Real Estate Advisor Platform",
    description:
      "A calm, structured workspace for real estate transactions — for advisors and their clients.",
    siteName: "DEED",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DEED — Real Estate Advisor Platform",
    description:
      "A calm, structured workspace for real estate transactions — for advisors and their clients.",
  },
};

// Explicit viewport so iOS Safari doesn't render at a desktop viewport width
// and miscalculate tap targets after zoom-on-focus. `maximumScale: 1` is
// deliberately omitted — that would block pinch-zoom, which is an a11y
// regression. Users who experience the small-input zoom can still pinch back.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Single-tenant MVP: fetch the one configured organization so its branding
  // is available on first paint everywhere — including the unauthenticated
  // login screen. Anon SELECT is permitted by the RLS policy in 0004.
  const organization = await getDefaultOrganization();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers initialOrganization={organization}>{children}</Providers>
      </body>
    </html>
  );
}
