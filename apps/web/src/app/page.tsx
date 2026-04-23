import Link from "next/link";

import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { PhoneFrame } from "@/components/site/PhoneFrame";

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
              <p
                className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary-bright)]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Figure it the f*ck out
              </p>
              <h1
                className="mt-4 text-[clamp(2.25rem,6vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.035em] text-[var(--text-primary)] text-balance"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Turn fitness videos into workouts{" "}
                <span className="text-[var(--primary)]">you actually do.</span>
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--text-secondary)] text-pretty sm:text-base">
                FitFo reads the TikToks and Reels you love, extracts the
                exercises, sets and reps, and drops them into a clean workout
                you can follow, edit, and track.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <a
                  href="mailto:nirv@fitfo.app?subject=FitFo%20Early%20Access"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 text-[13px] font-bold text-white shadow-[0_20px_45px_-15px_rgba(255,90,20,0.6)] transition hover:bg-[var(--primary-bright)]"
                >
                  Get early access
                  <span aria-hidden>→</span>
                </a>
                <Link
                  href="/marketing"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
                >
                  See how it works
                </Link>
              </div>

              <dl className="mt-8 grid max-w-sm grid-cols-3 gap-5">
                <Stat value="~30s" label="To parse a video" />
                <Stat value="100%" label="Private to you" />
                <Stat value="0" label="Ads forever" />
              </dl>
            </div>

            <div className="relative flex items-center justify-center lg:justify-end">
              <div aria-hidden className="bg-orange-glow absolute -inset-20" />
              <PhoneFrame
                src="/assets/IMG_4970.PNG"
                alt="FitFo app — paste a TikTok or Instagram link and get a structured workout"
                width={280}
                priority
                className="rotate-[-3deg]"
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-[var(--border-soft)] bg-[var(--bg)]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <Eyebrow>How it works</Eyebrow>
            <h2
              className="mt-3 max-w-2xl text-3xl font-bold leading-[1.05] tracking-[-0.025em] sm:text-4xl text-balance"
              style={{ fontFamily: "var(--font-display)" }}
            >
              From <span className="text-[var(--primary)]">inspiration</span> to{" "}
              <span className="text-[var(--primary)]">execution</span>, in three
              steps.
            </h2>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-6"
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
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature split rows */}
        <section className="border-t border-[var(--border-soft)]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="mb-14 max-w-2xl">
              <Eyebrow>What you get</Eyebrow>
              <h2
                className="mt-3 text-3xl font-bold leading-[1.05] tracking-[-0.025em] sm:text-4xl text-balance"
                style={{ fontFamily: "var(--font-display)" }}
              >
                A training app built for{" "}
                <span className="text-[var(--primary)]">content scrollers</span>
                .
              </h2>
            </div>

            <div className="flex flex-col gap-20">
              {FEATURES.map((feature, i) => (
                <div
                  key={feature.title}
                  className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
                    i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div className="flex justify-center lg:justify-start">
                    <PhoneFrame
                      src={feature.image}
                      alt={feature.title}
                      width={240}
                      glow
                    />
                  </div>
                  <div>
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Schedule + Archive row */}
        <section className="border-t border-[var(--border-soft)] bg-[var(--surface)]/40">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="grid gap-10 md:grid-cols-2">
              <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-7 sm:p-9">
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
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-7 sm:p-9">
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
                  />
                </div>
              </div>
            </div>
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
