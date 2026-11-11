import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getSite } from "@/features/content/queries";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

// Type system (from the Taha Seder reference): serif display, grotesk body, mono labels.
// The Latin woff2 files live in ./fonts (SIL OFL 1.1, see fonts/README.md), so builds never fetch from
// Google and the exact versions are pinned. next/font preloads them and adds size-adjusted fallbacks
// (no layout shift).
const serif = localFont({
  variable: "--font-instrument-serif",
  src: [
    { path: "./fonts/instrument-serif-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});
const sans = localFont({
  variable: "--font-geist",
  src: "./fonts/geist-latin-var.woff2",
  weight: "100 900",
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
});
const mono = localFont({
  variable: "--font-jetbrains-mono",
  src: "./fonts/jetbrains-mono-latin-var.woff2",
  weight: "400 500",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "Consolas", "monospace"],
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${site.name} — ${site.role}`,
      template: `%s — ${site.name}`,
    },
    description: site.description,
    applicationName: site.name,
    authors: [{ name: site.name, url: SITE_URL }],
    creator: site.name,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en",
      url: "/",
      title: `${site.name} — ${site.role}`,
      description: site.description,
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1 },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
