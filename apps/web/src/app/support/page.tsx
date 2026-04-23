import type { Metadata } from "next";

import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with FitFo. Troubleshoot imports, sign-in issues, account deletion, and more.",
};

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "I'm not receiving my SMS sign-in code.",
    a: (
      <>
        <p>
          SMS codes are sent via Twilio Verify and usually arrive within 10
          seconds. If yours hasn&apos;t shown up after a minute:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Confirm the phone number includes your country code (e.g. +1 for US).</li>
          <li>Check your carrier isn&apos;t filtering short-code messages.</li>
          <li>Tap &ldquo;Send code&rdquo; again after a 60-second wait.</li>
          <li>
            Still nothing? Email us at{" "}
            <a
              href="mailto:support@fitfo.app"
              className="text-[var(--primary-bright)] underline underline-offset-2"
            >
              support@fitfo.app
            </a>{" "}
            with the number you tried and we&apos;ll fix it.
          </li>
        </ul>
      </>
    ),
  },
  {
    q: "My video import failed or the workout came out wrong.",
    a: (
      <>
        <p>
          FitFo uses audio transcription and on-screen text OCR to extract
          workouts, so short, heavily-edited, or music-only videos can be tough.
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Make sure the source post is public (TikTok or Instagram Reels).</li>
          <li>
            Longer videos with clear voice-over or visible text work best — think
            creator explanations rather than 10-second montages.
          </li>
          <li>
            You can always edit the parsed workout: tap the title, exercise
            names, sets, reps, or notes and change them inline.
          </li>
          <li>
            If a specific video consistently parses wrong, tap &ldquo;Report an
            issue&rdquo; on the workout card and we&apos;ll get the link.
          </li>
        </ul>
      </>
    ),
  },
  {
    q: "How do I delete my account and my data?",
    a: (
      <>
        <p>
          Open the FitFo app → <strong>Profile</strong> tab →{" "}
          <strong>Delete Account</strong>. This permanently removes your
          profile, every saved and scheduled workout, every logged session, and
          any body-weight entries. For users signed in with Apple we also
          revoke the Apple Sign-In refresh token so the app disappears from
          Settings → Apple ID → Apps Using Apple ID.
        </p>
        <p className="mt-3">
          Can&apos;t sign in to delete? Email{" "}
          <a
            href="mailto:support@fitfo.app"
            className="text-[var(--primary-bright)] underline underline-offset-2"
          >
            support@fitfo.app
          </a>{" "}
          from the email associated with your account and we&apos;ll action it
          within 72 hours.
        </p>
      </>
    ),
  },
  {
    q: "Is my data private? What do you collect?",
    a: (
      <>
        <p>
          FitFo collects only what it needs to run the app: your phone number
          (for sign-in), name/email (if you use Apple Sign-In), the workouts
          you save, the sessions you log, and body-weight entries you add. We
          do not sell data, share it with advertisers, or run third-party ad
          SDKs. Full details are on our{" "}
          <a
            href="/privacy"
            className="text-[var(--primary-bright)] underline underline-offset-2"
          >
            Privacy Policy
          </a>
          .
        </p>
      </>
    ),
  },
  {
    q: "Do FitFo workouts belong to the original creator?",
    a: (
      <>
        <p>
          Yes. FitFo does not host or redistribute any third-party video
          content. When you paste a link, we extract factual exercise data
          (names, sets, reps) and always link back to the original post via the
          &ldquo;View on TikTok&rdquo; / &ldquo;View on Instagram&rdquo; button
          on every imported workout. If you&apos;re a creator and want your
          content removed, email{" "}
          <a
            href="mailto:support@fitfo.app"
            className="text-[var(--primary-bright)] underline underline-offset-2"
          >
            support@fitfo.app
          </a>{" "}
          with the URL and we&apos;ll remove it from our systems.
        </p>
      </>
    ),
  },
  {
    q: "Is FitFo free?",
    a: (
      <>
        <p>
          FitFo is free to use while we&apos;re in beta. If we add premium
          features in the future (e.g. higher video volume, advanced analytics)
          we&apos;ll give everyone plenty of notice and the core &ldquo;paste a
          link, get a workout&rdquo; loop will always remain available.
        </p>
      </>
    ),
  },
  {
    q: "Does FitFo give medical or training advice?",
    a: (
      <>
        <p>
          No. FitFo turns the content of videos into structured data. Workouts
          parsed from videos are labeled <strong>AI-Parsed</strong> and may
          contain errors — always verify sets, reps, and weights before
          training and talk to a doctor or qualified coach if you have any
          concerns about a particular exercise or load.
        </p>
      </>
    ),
  },
];

export default function SupportPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="relative overflow-hidden border-b border-[var(--border-soft)]">
          <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
          <div className="mx-auto max-w-4xl px-5 pb-20 pt-20 sm:px-8 sm:pb-24 sm:pt-28">
            <p
              className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--primary-bright)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Support
            </p>
            <h1
              className="mt-4 text-5xl font-bold leading-[0.98] tracking-[-0.035em] sm:text-6xl text-balance"
              style={{ fontFamily: "var(--font-display)" }}
            >
              We&apos;re on call — <span className="text-[var(--primary)]">mostly</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)] text-pretty">
              Something broken? A workout parsed wrong? Want your creator
              content removed? This page has the most common fixes. For
              anything else we respond fast at{" "}
              <a
                href="mailto:support@fitfo.app"
                className="text-[var(--primary-bright)] underline underline-offset-2"
              >
                support@fitfo.app
              </a>
              .
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <ContactCard
                title="Email support"
                body="Best for account issues, takedowns, and anything that needs a reply."
                cta="support@fitfo.app"
                href="mailto:support@fitfo.app"
              />
              <ContactCard
                title="Report a workout"
                body="If an AI-parsed workout is wrong, use the Report link inside the app."
                cta="Open the app"
                href="/"
              />
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-24">
            <h2
              className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Frequently asked questions
            </h2>

            <div className="mt-10 divide-y divide-[var(--border-soft)] rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)]">
              {FAQS.map((faq, i) => (
                <details key={i} className="group p-6 sm:p-7">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                    <h3
                      className="text-lg font-semibold tracking-[-0.01em] text-[var(--text-primary)] sm:text-xl"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {faq.q}
                    </h3>
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-soft)] text-[var(--text-secondary)] transition group-open:rotate-45 group-open:border-[var(--primary)] group-open:text-[var(--primary)]">
                      +
                    </span>
                  </summary>
                  <div className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>

            <p className="mt-10 text-sm text-[var(--text-muted)]">
              Didn&apos;t find what you needed? Email us at{" "}
              <a
                href="mailto:support@fitfo.app"
                className="text-[var(--primary-bright)] underline underline-offset-2"
              >
                support@fitfo.app
              </a>{" "}
              and we&apos;ll get back to you within a business day.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function ContactCard({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group block rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 transition hover:border-[var(--primary)]/60 hover:bg-[var(--surface-muted)]"
    >
      <h3
        className="text-lg font-bold tracking-[-0.01em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
        {body}
      </p>
      <p className="mt-5 text-[13px] font-semibold text-[var(--primary-bright)]">
        {cta} <span aria-hidden>→</span>
      </p>
    </a>
  );
}
