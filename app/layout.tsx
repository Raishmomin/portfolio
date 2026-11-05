import type React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import { ScrollProgress } from "../components/scroll-progress";
import { JsonLd } from "../components/json-ld";
import { REVEAL_SCRIPT } from "../components/reveal";
import { SITE, SITE_URL } from "@/lib/config";
import { PROFILE } from "@/lib/profile";
import { RSS_URL } from "@/lib/seo";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

// Accent only (one italic clause per headline) — never the LCP font.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
  preload: false,
  variable: "--font-instrument-serif",
});

// A function rather than a constant: SITE.description carries the derived years
// figure, which must be read per render, not once at module load.
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: SITE.title,
      template: `%s | ${SITE.name}`,
    },
    description: SITE.description,
    keywords: [
      "full stack developer",
      "React developer",
      "Node.js engineer",
      "DevOps engineer",
      "MERN stack",
      "MongoDB",
      "Next.js",
      "TypeScript",
      "Raish Momin",
      "portfolio",
    ],
    authors: [{ name: SITE.name, url: SITE_URL }],
    creator: SITE.name,
    publisher: SITE.name,
    applicationName: SITE.name,
    category: "technology",
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url: SITE_URL,
      siteName: SITE.name,
      title: SITE.title,
      description: SITE.description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${SITE.name} — Portfolio`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE.title,
      description: SITE.description,
      images: ["/twitter-image"],
      creator: PROFILE.social.xHandle,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    alternates: {
      canonical: SITE_URL,
      types: {
        "application/rss+xml": [{ url: RSS_URL, title: `${SITE.name} — Blog` }],
      },
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
    // No `icons` here: app/favicon.ico, app/icon.svg and app/apple-icon.tsx emit
    // hashed <link> tags by file convention. A config value would replace them.
    formatDetection: {
      email: false,
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SITE.themeColor.light },
    { media: "(prefers-color-scheme: dark)", color: SITE.themeColor.dark },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Sets html.js and drives the CSS reveal animations; content stays visible without it. */}
        <script dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }} />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} font-sans relative`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ScrollProgress />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-foreground focus:text-background"
          >
            Skip to content
          </a>
          {children}
          <JsonLd />
        </ThemeProvider>
      </body>
    </html>
  );
}
