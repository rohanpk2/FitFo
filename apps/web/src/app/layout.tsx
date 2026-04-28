import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-host the same Fontshare TTFs the mobile app ships. Using next/font/local
// guarantees the fonts ship from our own origin with the site, no CDN race
// that leaves the UI rendered in a system fallback for the first paint.
const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Satoshi-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Satoshi-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Satoshi-Black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const clashDisplay = localFont({
  src: [
    { path: "./fonts/ClashDisplay-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/ClashDisplay-Semibold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/ClashDisplay-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

const ICON = "/vector-no-bg.png";
const SITE_URL = "https://fitfo.app";
const APP_STORE_URL = "https://apps.apple.com/app/id6762418380";
const DESCRIPTION =
  "Fitfo turns TikTok and Instagram fitness videos into structured, followable workouts you can save, schedule, edit, and log.";
const KEYWORDS = [
  "Fitfo",
  "fitness app",
  "workout app",
  "AI workout app",
  "TikTok workout app",
  "Instagram Reels workout app",
  "turn fitness videos into workouts",
  "workout tracker",
  "workout planner",
  "iOS fitness app",
  "exercise parser",
  "AI fitness",
];

export const metadata: Metadata = {
  metadataBase: new URL("https://fitfo.app"),
  applicationName: "Fitfo",
  title: {
    default: "Fitfo",
    template: "%s · Fitfo",
  },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  authors: [{ name: "Vaayu Athletics LLC" }],
  creator: "Vaayu Athletics LLC",
  publisher: "Vaayu Athletics LLC",
  category: "Health & Fitness",
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    title: "Fitfo",
    statusBarStyle: "black-translucent",
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
  openGraph: {
    title: "Fitfo | Turn Fitness Videos Into Workouts",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Fitfo",
    type: "website",
    locale: "en_US",
    images: [ICON],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fitfo | Turn Fitness Videos Into Workouts",
    description: DESCRIPTION,
    images: [ICON],
  },
  appLinks: {
    ios: {
      url: APP_STORE_URL,
      app_store_id: "6762418380",
      app_name: "Fitfo",
    },
  },
  icons: {
    icon: [
      { url: ICON, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: ICON, sizes: "512x512", type: "image/png" }],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Vaayu Athletics LLC",
      url: SITE_URL,
      logo: `${SITE_URL}${ICON}`,
      sameAs: [APP_STORE_URL],
      contactPoint: {
        "@type": "ContactPoint",
        email: "nirv@fitfo.app",
        contactType: "customer support",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Fitfo",
      url: SITE_URL,
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": ["MobileApplication", "SoftwareApplication"],
      "@id": `${SITE_URL}/#app`,
      name: "Fitfo",
      alternateName: "Fitfo Workout App",
      url: SITE_URL,
      downloadUrl: APP_STORE_URL,
      operatingSystem: "iOS",
      applicationCategory: "HealthApplication",
      applicationSubCategory: "Workout tracker",
      description: DESCRIPTION,
      image: `${SITE_URL}${ICON}`,
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Import public TikTok and Instagram workout videos",
        "Extract exercises, sets, reps, rest, and notes with AI",
        "Save, schedule, edit, and log workouts on iPhone",
        "Track workout history without ads",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/support#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What does Fitfo do?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Fitfo turns public TikTok and Instagram workout videos into structured workouts with exercises, sets, reps, rest times, and notes.",
          },
        },
        {
          "@type": "Question",
          name: "Is Fitfo available on iPhone?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Fitfo is available for iPhone on the App Store.",
          },
        },
        {
          "@type": "Question",
          name: "Does Fitfo host TikTok or Instagram videos?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Fitfo does not host or redistribute third-party video content. It extracts factual workout data and links back to the original source post.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${satoshi.variable} ${clashDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg font-sans text-text-primary">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
