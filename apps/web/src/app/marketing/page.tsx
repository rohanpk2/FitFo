import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { PhoneFrame } from "@/components/site/PhoneFrame";

export const metadata: Metadata = {
  title: "Press & Marketing",
  description:
    "Everything you need to write about FitFo: boilerplate, screenshots, brand colors, and contact.",
};

const SCREENS = [
  { src: "/assets/IMG_4970.PNG", label: "Import workout modal" },
  { src: "/assets/IMG_4966.PNG", label: "Workouts library" },
  { src: "/assets/IMG_4967.PNG", label: "Workout detail" },
  { src: "/assets/IMG_4971.PNG", label: "Scheduled calendar" },
  { src: "/assets/IMG_4969.PNG", label: "Schedule again modal" },
  { src: "/assets/IMG_4968.PNG", label: "Training archive" },
];

const SWATCHES = [
  { name: "Primary", hex: "#FF5A14", bg: "#FF5A14", text: "#fff" },
  { name: "Primary Bright", hex: "#FF6A2C", bg: "#FF6A2C", text: "#fff" },
  { name: "Background", hex: "#0B0B0C", bg: "#0B0B0C", text: "#F5F5F4" },
  { name: "Surface", hex: "#151517", bg: "#151517", text: "#F5F5F4" },
  { name: "Text Primary", hex: "#F5F5F4", bg: "#F5F5F4", text: "#0B0B0C" },
  { name: "Text Secondary", hex: "#A1A1AA", bg: "#A1A1AA", text: "#0B0B0C" },
];

export default function MarketingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-[var(--border-soft)]">
          <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
          <div className="mx-auto max-w-5xl px-5 pb-20 pt-20 sm:px-8 sm:pb-24 sm:pt-28">
            <p
              className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary-bright)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Press & media
            </p>
            <h1
              className="mt-3 text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-5xl text-balance"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Write about FitFo. <span className="text-[var(--primary)]">We&apos;ll make it easy.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)] text-pretty sm:text-base">
              Everything you need, boilerplate, screenshots, brand colors, and
              a human to talk to. For interviews, feature requests, or creator
              partnerships, reach us at{" "}
              <a
                href="mailto:nirv@fitfo.app"
                className="text-[var(--primary-bright)] underline underline-offset-2"
              >
                nirv@fitfo.app
              </a>
              .
            </p>
          </div>
        </section>

        {/* About / boilerplate */}
        <section className="border-b border-[var(--border-soft)]">
          <div className="mx-auto grid max-w-5xl gap-12 px-5 py-20 sm:px-8 sm:py-24 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary-bright)]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                About
              </p>
              <h2
                className="mt-3 text-2xl font-bold tracking-[-0.015em] sm:text-3xl text-balance"
                style={{ fontFamily: "var(--font-display)" }}
              >
                What FitFo does.
              </h2>
            </div>
            <div className="space-y-4 text-[14px] leading-relaxed text-[var(--text-secondary)] text-pretty">
              <p>
                <strong className="text-[var(--text-primary)]">FitFo</strong> is
                a fitness app that turns TikTok and Instagram workout videos
                into structured, followable training plans. Users share a
                public video straight from TikTok or Reels into FitFo, just
                like sending it to a friend, and get back a clean card with
                exercises, sets, reps, rest times, and notes, ready to save,
                schedule, edit, and log.
              </p>
              <p>
                The product sits at the intersection of three behaviors most
                fitness apps ignore: people already follow creators on short
                video, already take screenshots of workouts, and already feel
                overwhelmed trying to reverse-engineer reels into real plans.
                FitFo closes the loop between &ldquo;inspiration&rdquo; and
                &ldquo;execution.&rdquo;
              </p>
              <p>
                FitFo is built by Vaayu Athletics LLC and is available now on
                the App Store. Download it{" "}
                <a
                  href="https://apps.apple.com/app/id6762418380"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--primary-bright)] underline underline-offset-2"
                >
                  here
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Screenshots */}
        <section className="border-b border-[var(--border-soft)]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary-bright)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Screenshots
                </p>
                <h2
                  className="mt-3 text-2xl font-bold tracking-[-0.015em] sm:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Press-ready product shots.
                </h2>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-8 sm:gap-10 md:grid-cols-3">
              {SCREENS.map((s) => (
                <figure key={s.src} className="flex flex-col items-center gap-4">
                  <PhoneFrame src={s.src} alt={s.label} width={200} />
                  <figcaption className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {s.label}
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="mt-10 text-sm text-[var(--text-muted)]">
              Need full-resolution assets or a logo zip? Email{" "}
              <a
                href="mailto:nirv@fitfo.app"
                className="text-[var(--primary-bright)] underline underline-offset-2"
              >
                nirv@fitfo.app
              </a>{" "}
              and we&apos;ll send them over.
            </p>
          </div>
        </section>

        

        {/* Facts */}
        <section className="border-b border-[var(--border-soft)]">
          <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-24">
            <p
              className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary-bright)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Fact sheet
            </p>
            <h2
              className="mt-3 text-2xl font-bold tracking-[-0.015em] sm:text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              The quick version.
            </h2>

            <dl className="mt-10 divide-y divide-[var(--border-soft)] rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)]">
              <Fact term="Company" value="Vaayu Athletics LLC" />
              <Fact term="Product" value="FitFo, iOS fitness app" />
              <Fact term="Launched" value="2026" />
              <Fact term="Platforms" value="iOS (iPhone)" />
              <Fact term="Price" value="Free to download" />
              <Fact
                term="Category"
                value="Health & Fitness"
              />
              <Fact
                term="Press contact"
                value={
                  <a
                    href="mailto:nirv@fitfo.app"
                    className="text-[var(--primary-bright)] underline underline-offset-2"
                  >
                    nirv@fitfo.app
                  </a>
                }
              />
              <Fact
                term="Support"
                value={
                  <a
                    href="mailto:nirv@fitfo.app"
                    className="text-[var(--primary-bright)] underline underline-offset-2"
                  >
                    nirv@fitfo.app
                  </a>
                }
              />
            </dl>
          </div>
        </section>

        {/* Terms anchor */}
        <section id="terms" className="border-b border-[var(--border-soft)]">
          <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-24">
            <p
              className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary-bright)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Terms of use, summary
            </p>
            <h2
              className="mt-3 text-2xl font-bold tracking-[-0.015em] sm:text-3xl text-balance"
              style={{ fontFamily: "var(--font-display)" }}
            >
              The short version.
            </h2>
            <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">
              <p>
                By using FitFo you agree that: the service is provided as-is;
                workouts parsed from videos are for informational purposes only
                and are not medical, training, or nutritional advice; you are
                responsible for the URLs you submit and represent that you
                have the right to analyze them; FitFo may remove content at its
                discretion, particularly following a creator takedown request.
              </p>
              <p>
                FitFo does not host or redistribute third-party video content.
                We extract factual exercise data (names, sets, reps) and link
                back to the original post. Creator takedown requests should go
                to{" "}
                <a
                  href="mailto:nirv@fitfo.app"
                  className="text-[var(--primary-bright)] underline underline-offset-2"
                >
                  nirv@fitfo.app
                </a>{" "}
                with the URL.
              </p>
              <p>
                For how we handle your data, see our{" "}
                <Link
                  href="/privacy"
                  className="text-[var(--primary-bright)] underline underline-offset-2"
                >
                  Privacy Policy
                </Link>
                .
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Last updated: April 22, 2026
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Fact({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_1.8fr] gap-4 px-6 py-5 sm:px-8">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {term}
      </dt>
      <dd className="text-[15px] text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}
