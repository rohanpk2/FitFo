import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-host the same Fontshare TTFs the mobile app ships. Using next/font/local
// guarantees the fonts ship from our own origin with the site — no CDN race
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

export const metadata: Metadata = {
  metadataBase: new URL("https://fitfo.app"),
  title: {
    default: "FitFo — Turn fitness videos into real workouts",
    template: "%s · FitFo",
  },
  description:
    "FitFo turns fitness videos you find on TikTok and Instagram into structured, followable workouts. Paste a link, get a plan you can actually do.",
  openGraph: {
    title: "FitFo — Turn fitness videos into real workouts",
    description:
      "Paste any TikTok or Instagram fitness video. FitFo extracts the exercises, sets, and reps into a clean, trackable workout.",
    url: "https://fitfo.app",
    siteName: "FitFo",
    type: "website",
    images: ["/fitfo-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FitFo — Turn fitness videos into real workouts",
    description:
      "Paste any TikTok or Instagram fitness video. FitFo extracts the exercises, sets, and reps into a clean, trackable workout.",
    images: ["/fitfo-logo.png"],
  },
  icons: {
    icon: "/fitfo-logo.png",
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
      <body className="min-h-full bg-[var(--bg)] font-sans text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
