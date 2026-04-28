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

const ICON_180 = "/Fitfo-VectorTrace-180.png";
const ICON_512 = "/Fitfo-VectorTrace-512.png";
const ICON_1024 = "/Fitfo-VectorTrace-1024.png";
const ICON_SVG = "/Fitfo-VectorTrace-1024.svg";

export const metadata: Metadata = {
  metadataBase: new URL("https://fitfo.app"),
  title: {
    default: "Fitfo",
    template: "%s · Fitfo",
  },
  description:
    "Fitfo turns fitness videos you find on TikTok and Instagram into structured, followable workouts. Available now on the App Store.",
  openGraph: {
    title: "Fitfo, Now on the App Store",
    description:
      "Share any TikTok or Instagram fitness video straight to Fitfo. Our AI extracts the exercises, sets, and reps into a clean, trackable workout. Available now on iOS.",
    url: "https://fitfo.app",
    siteName: "Fitfo",
    type: "website",
    images: [ICON_1024],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fitfo, Now on the App Store",
    description:
      "Share any TikTok or Instagram fitness video straight to Fitfo. Our AI extracts the exercises, sets, and reps into a clean, trackable workout. Available now on iOS.",
    images: [ICON_1024],
  },
  icons: {
    icon: [
      { url: ICON_SVG, type: "image/svg+xml" },
      { url: ICON_512, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: ICON_180, sizes: "180x180", type: "image/png" }],
  },
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
        {children}
      </body>
    </html>
  );
}
