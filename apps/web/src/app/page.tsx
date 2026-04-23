import Link from "next/link";

import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { PhoneFrame } from "@/components/site/PhoneFrame";
import { Reveal } from "@/components/site/Reveal";

const APP_STORE_URL = "https://apps.apple.com/app/id6762418380";

const FEATURES = [
  {
    eyebrow: "Import",
    title: "Paste a link, get a workout",
    copy: "Drop in any TikTok or Instagram Reel. FitFo pulls the audio, reads the on-screen text, and turns it into a clean, structured session.",
    image: "/assets/IMG_4970.PNG",
  },
  {
    eyebrow: "Organize",
    title: "A library that knows what it is",
    copy: "Saved workouts, scheduled sessions, and logged history — each one tagged by muscle group and block so you can find them fast.",
    image: "/assets/IMG_4966.PNG",
  },
  {
    eyebrow: "Train",
    title: "Edit, follow, log, no friction",
    copy: "Tap any field to change reps, weights, or notes. Start a session, log every set, and the next one opens automatically.",
    image: "/assets/IMG_4967.PNG",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Paste a fitness video",
    body: "TikTok, Instagram Reels — anything public. We read what the creator actually said and showed.",
  },
  {
    n: "02",
    title: "Get a structured plan",
    body: "Exercises, sets, reps, rest, notes — all extracted into a card you can edit, save, or start immediately.",
  },
  {
    n: "03",
    title: "Train it, log it, repeat",
    body: "Follow the workout in-app, log every set, and come back to the same plan any day of the week.",
  },
];

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main className="relative">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
          <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8 lg:pb-28 lg:pt-24">
            <div>
              <div
                className="hero-anim inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/30 bg-[var(--primary-soft)] px-3 py-1"
                style={{ animationDelay: "80ms" }}
              >
                <span
                  aria-hidden
                  className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--primary-bright)]"
                />
                <span
                  className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--primary-bright)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Now available on iOS
                </span>
              </div>
              <h1
                className="hero-anim mt-4 text-[clamp(2.25rem,6vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.035em] text-[var(--text-primary)] text-balance"
                style={{
                  fontFamily: "var(--font-display)",
                  animationDelay: "180ms",
                }}
              >
                Turn fitness videos into workouts{" "}
                <span className="text-[var(--primary)]">you actually do.</span>
              </h1>
              <p
                className="hero-anim mt-5 max-w-md text-[15px] leading-relaxed text-[var(--text-secondary)] text-pretty sm:text-base"
                style={{ animationDelay: "300ms" }}
              >
                FitFo reads the TikToks and Reels you love, extracts the
                exercises, sets and reps, and drops them into a clean workout
                you can follow, edit, and track.
              </p>

              <div
                className="hero-anim mt-7 flex flex-wrap items-center gap-2.5"
                style={{ animationDelay: "420ms" }}
              >
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="cta-lift inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 text-[13px] font-bold text-white shadow-[0_20px_45px_-15px_rgba(255,90,20,0.6)] hover:bg-[var(--primary-bright)] hover:shadow-[0_24px_55px_-12px_rgba(255,90,20,0.75)]"
                >
                  Download on the App Store
                  <span aria-hidden className="arrow-nudge">
                    →
                  </span>
                </a>
                <Link
                  href="/marketing"
                  className="cta-lift inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  See how it works
                </Link>
              </div>

              <dl
                className="hero-anim mt-8 grid max-w-sm grid-cols-3 gap-5"
                style={{ animationDelay: "540ms" }}
              >
                <Stat value="~30s" label="To parse a video" />
                <Stat value="100%" label="Private to you" />
                <Stat value="0" label="Ads forever" />
              </dl>
            </div>

            <div className="relative flex items-center justify-center lg:justify-end">
              <div
                aria-hidden
                className="bg-orange-glow glow-breathe absolute -inset-20"
              />
              <div
                className="hero-anim-right"
                style={
                  {
                    "--enter-rotate": "-3deg",
                    animationDelay: "260ms",
                  } as React.CSSProperties
                }
              >
                <PhoneFrame
                  src="/assets/IMG_4970.PNG"
                  alt="FitFo app — paste a TikTok or Instagram link and get a structured workout"
                  width={280}
                  priority
                  float
                  rotate={-3}
                />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-[var(--border-soft)] bg-[var(--bg)]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <Reveal>
              <Eyebrow>How it works</Eyebrow>
              <h2
                className="mt-3 max-w-2xl text-3xl font-bold leading-[1.05] tracking-[-0.025em] sm:text-4xl text-balance"
                style={{ fontFamily: "var(--font-display)" }}
              >
                From{" "}
                <span className="text-[var(--primary)]">inspiration</span> to{" "}
                <span className="text-[var(--primary)]">execution</span>, in
                three steps.
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal
                  key={step.n}
                  delay={120 + i * 120}
                  variant="scale"
                  className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-muted)]"
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--primary-bright)]"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    Step {step.n}
                  </p>
                  <h3
                    className="mt-2.5 text-xl font-bold tracking-[-0.015em]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {step.body}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Feature split rows */}
        <section className="border-t border-[var(--border-soft)]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <Reveal className="mb-14 max-w-2xl">
              <Eyebrow>What you get</Eyebrow>
              <h2
                className="mt-3 text-3xl font-bold leading-[1.05] tracking-[-0.025em] sm:text-4xl text-balance"
                style={{ fontFamily: "var(--font-display)" }}
              >
                A training app built for{" "}
                <span className="text-[var(--primary)]">content scrollers</span>
                .
              </h2>
            </Reveal>

            <div className="flex flex-col gap-20">
              {FEATURES.map((feature, i) => (
                <div
                  key={feature.title}
                  className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
                    i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <Reveal
                    variant="scale"
                    delay={60}
                    className="flex justify-center lg:justify-start"
                  >
                    <PhoneFrame
                      src={feature.image}
                      alt={feature.title}
                      width={240}
                      glow
                      float={i % 2 === 0 ? "slow" : true}
                    />
                  </Reveal>
                  <Reveal delay={180}>
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--primary-bright)]"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {feature.eyebrow}
                    </p>
                    <h3
                      className="mt-3 text-2xl font-bold leading-[1.08] tracking-[-0.025em] sm:text-3xl text-balance"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {feature.title}
                    </h3>
                    <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--text-secondary)] text-pretty">
                      {feature.copy}
                    </p>
                  </Reveal>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Schedule + Archive row */}
        <section className="border-t border-[var(--border-soft)] bg-[var(--surface)]/40">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="grid gap-10 md:grid-cols-2">
              <Reveal
                variant="scale"
                delay={0}
                className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-7 transition hover:border-[var(--primary)]/40 sm:p-9"
              >
                <Eyebrow>Calendar</Eyebrow>
                <h3
                  className="mt-3 text-2xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-3xl text-balance"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Schedule the week. <br />
                  <span className="text-[var(--primary)]">Show up to it.</span>
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  Drop any saved workout onto a day. Get a clean calendar view
                  of what&apos;s coming so you stop negotiating with yourself
                  every morning.
                </p>
                <div className="mt-8 flex justify-center">
                  <PhoneFrame
                    src="/assets/IMG_4971.PNG"
                    alt="Scheduled workouts calendar"
                    width={210}
                    float="slow"
                  />
                </div>
              </Reveal>

              <Reveal
                variant="scale"
                delay={140}
                className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-7 transition hover:border-[var(--primary)]/40 sm:p-9"
              >
                <Eyebrow>Logs</Eyebrow>
                <h3
                  className="mt-3 text-2xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-3xl text-balance"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Every rep, <br />
                  <span className="text-[var(--primary)]">on the record.</span>
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  Completed sessions turn into a clean archive. See how many
                  sets you&apos;ve logged this month and schedule your best
                  workouts again with a tap.
                </p>
                <div className="mt-8 flex justify-center">
                  <PhoneFrame
                    src="/assets/IMG_4968.PNG"
                    alt="Training archive screen"
                    width={210}
                    float
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Final CTA — live on iOS */}
        <section className="relative overflow-hidden border-t border-[var(--border-soft)]">
          <div
            aria-hidden
            className="bg-orange-glow glow-breathe absolute inset-0 -z-10"
          />
          <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-24">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/30 bg-[var(--primary-soft)] px-3 py-1">
                <span
                  aria-hidden
                  className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--primary-bright)]"
                />
                <span
                  className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--primary-bright)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Live on iOS
                </span>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2
                className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-5xl text-balance"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Train with the content{" "}
                <span className="text-[var(--primary)]">
                  you already love.
                </span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] text-[var(--text-secondary)] text-pretty sm:text-base">
                FitFo is available now on the App Store. Paste your first
                TikTok or Instagram Reel and be lifting off a real plan in
                under a minute.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="cta-lift inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 text-[13px] font-bold text-white shadow-[0_20px_45px_-15px_rgba(255,90,20,0.6)] hover:bg-[var(--primary-bright)] hover:shadow-[0_24px_55px_-12px_rgba(255,90,20,0.75)]"
                >
                  Download on the App Store
                  <span aria-hidden className="arrow-nudge">
                    →
                  </span>
                </a>
                <Link
                  href="/support"
                  className="cta-lift inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  Questions? Hit support
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt
        className="text-xl font-bold tracking-[-0.02em] text-[var(--text-primary)] sm:text-2xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </dt>
      <dd className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </dd>
    </div>
  );
}

function Eyebrow({
  children,
  center = false,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <p
      className={`text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary-bright)] ${
        center ? "text-center" : ""
      }`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {children}
    </p>
  );
}
