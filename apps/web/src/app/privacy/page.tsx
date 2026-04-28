import type { Metadata } from "next";

import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Fitfo collects, uses, and protects your data. Plain English, no dark patterns.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="relative overflow-hidden border-b border-[var(--border-soft)]">
          <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
          <div className="mx-auto max-w-3xl px-5 pb-16 pt-20 sm:px-8 sm:pb-20 sm:pt-28">
            <p
              className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary-bright)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Privacy
            </p>
            <h1
              className="mt-3 text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-5xl text-balance"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Privacy Policy.
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--text-secondary)] text-pretty sm:text-base">
              Fitfo is built by a small team that trains every day. This policy
              explains, in plain English, what we collect, why, who touches it,
              and how to get rid of it whenever you want.
            </p>
            <p className="mt-3 text-[12px] text-[var(--text-muted)]">
              Effective date: April 22, 2026
            </p>
          </div>
        </section>

        <section>
          <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
            <Prose>
              <H2>1. TL;DR</H2>
              <ul>
                <li>We collect the minimum needed to sign you in and run the app.</li>
                <li>
                  We do not sell your data and we do not run advertising or
                  third-party ad SDKs.
                </li>
                <li>
                  You can delete your account and all associated data from
                  inside the app at any time.
                </li>
                <li>
                  Questions? Email{" "}
                  <a href="mailto:nirv@fitfo.app">nirv@fitfo.app</a>.
                </li>
              </ul>

              <H2>2. Who we are</H2>
              <p>
                &ldquo;Fitfo,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; and
                &ldquo;our&rdquo; refer to <strong>Vaayu Athletics LLC</strong>
                , a US-based company that operates the Fitfo mobile app and the
                website at fitfo.app. You can reach us at{" "}
                <a href="mailto:nirv@fitfo.app">nirv@fitfo.app</a>.
              </p>

              <H2>3. What we collect</H2>
              <p>
                Fitfo collects only the information needed to authenticate you
                and operate the app. That includes:
              </p>
              <ul>
                <li>
                  <strong>Account &amp; contact info.</strong> Your phone
                  number (if you sign in with SMS) or your name and email (if
                  you use Sign in with Apple). If Apple relays a private email,
                  that private relay is what we store.
                </li>
                <li>
                  <strong>Profile &amp; onboarding.</strong> Goals, training
                  split, days per week, weight, height, experience level, and
                  age that you enter during onboarding.
                </li>
                <li>
                  <strong>Workout content.</strong> Workouts you save,
                  schedule, or create; sessions you log (sets, reps, weights,
                  durations, notes, completion timestamps); body-weight entries
                  you record.
                </li>
                <li>
                  <strong>Source URLs.</strong> TikTok and Instagram Reel URLs
                  you share into the app for import, plus the extracted
                  metadata and transcript we generate from them.
                </li>
                <li>
                  <strong>Device identifiers.</strong> A user ID we assign to
                  your account. We do not use Apple&apos;s advertising
                  identifier (IDFA) and do not integrate any advertising SDKs.
                </li>
                <li>
                  <strong>Apple Sign-In refresh token.</strong> If you signed
                  in with Apple, we store the refresh token solely so we can
                  revoke the token with Apple when you delete your account, as
                  required by App Store Guideline 5.1.1(v).
                </li>
              </ul>

              <H3>What we do not collect</H3>
              <ul>
                <li>
                  We do not collect precise or coarse location, contacts, photos,
                  videos, microphone audio, health data from HealthKit, or any
                  sensitive personal information.
                </li>
                <li>
                  We do not run advertising SDKs, analytics SDKs, crash
                  reporters, or third-party tracking SDKs in the iOS app.
                </li>
              </ul>

              <H2>4. How we use your information</H2>
              <ul>
                <li>Authenticate you via SMS one-time codes or Sign in with Apple.</li>
                <li>Store and display the workouts, sessions, and notes you create.</li>
                <li>
                  Process the TikTok and Instagram URLs you submit by fetching
                  public metadata, transcribing audio, and running OCR on a
                  small number of frames so we can extract exercise data.
                </li>
                <li>Respond to support requests.</li>
                <li>Protect against abuse and comply with legal obligations.</li>
              </ul>
              <p>
                We never use your data for advertising, profiling for
                third-party advertisers, or sale to data brokers.
              </p>

              <H2>5. Third-party services (sub-processors)</H2>
              <p>
                We use a small number of reputable vendors to run the app.
                Each processes only the data needed for its specific function:
              </p>
              <ul>
                <li>
                  <strong>Supabase</strong>, database and file storage for
                  profiles, workouts, and session logs (hosted on AWS in the
                  United States).
                </li>
                <li>
                  <strong>Twilio Verify</strong>, sending SMS one-time
                  verification codes to your phone number.
                </li>
                <li>
                  <strong>Apple</strong>, Sign in with Apple authentication
                  and refresh-token revocation when you delete your account.
                </li>
                <li>
                  <strong>Apify</strong>, fetching public metadata from
                  TikTok and Instagram URLs you submit.
                </li>
                <li>
                  <strong>OpenAI</strong>, running transcription, OCR, and
                  language-model processing on the video, audio, and text
                  extracted from videos you submit.
                </li>
                <li>
                  <strong>DigitalOcean</strong>, hosting our API servers.
                </li>
              </ul>
              <p>
                These providers are contractually required to handle data only
                on our behalf and in line with their own privacy terms. We do
                not sell data to any of them.
              </p>

              <H2>6. How long we keep data</H2>
              <p>
                We keep your data for as long as your account is active. When
                you delete your account (Profile → Delete Account inside the
                app) we immediately and permanently remove your profile,
                workouts, sessions, and body-weight entries from Supabase. Some
                server logs or backups may persist for up to 30 days before
                being fully expunged.
              </p>

              <H2>7. Your rights</H2>
              <p>
                You can, at any time:
              </p>
              <ul>
                <li>
                  <strong>Access</strong> or export your data. Email us and
                  we&apos;ll send you a copy within 30 days.
                </li>
                <li>
                  <strong>Correct</strong> inaccurate data. Most fields are
                  editable directly inside the app.
                </li>
                <li>
                  <strong>Delete</strong> your account and all associated
                  data. Use <em>Profile → Delete Account</em> inside the app,
                  or email us.
                </li>
                <li>
                  <strong>Object</strong> to processing or withdraw consent.
                  Simply stop using the app and request deletion.
                </li>
              </ul>
              <p>
                Residents of California (CCPA/CPRA), the EEA / UK (GDPR), and
                other jurisdictions with equivalent laws are entitled to the
                same rights above without charge. We do not sell or share
                personal information for cross-context behavioral advertising.
              </p>

              <H2>8. Children</H2>
              <p>
                Fitfo is not directed to children under 13 and we do not
                knowingly collect personal information from anyone under 13. If
                you believe a child has provided us data, email us and we&apos;ll
                delete it.
              </p>

              <H2>9. International transfers</H2>
              <p>
                Our servers and sub-processors are primarily located in the
                United States. If you access Fitfo from outside the US, you
                consent to your data being transferred to and processed in the
                US under the safeguards described in this policy.
              </p>

              <H2>10. Security</H2>
              <p>
                All traffic between your device and our servers uses HTTPS/TLS.
                Stored data is encrypted at rest by our infrastructure
                providers. Access to production data is limited to a small
                number of engineers using least-privilege credentials. No
                method of transmission or storage is perfectly secure, but we
                work hard to treat your data with the same care we&apos;d want
                for our own.
              </p>

              <H2>11. Third-party content (TikTok / Instagram videos)</H2>
              <p>
                Fitfo does not host or redistribute third-party video content.
                When you share a TikTok or Instagram video into Fitfo, we
                fetch public metadata, transcribe audio, and run OCR on
                frames to extract factual exercise information (names, sets,
                reps, rest). We always link back to the original post inside
                the app via the &ldquo;View on TikTok&rdquo; or &ldquo;View on
                Instagram&rdquo; button. Creators who want their content
                excluded from the service can email{" "}
                <a href="mailto:nirv@fitfo.app">nirv@fitfo.app</a> with
                the URL and we&apos;ll remove it.
              </p>

              <H2>12. Changes to this policy</H2>
              <p>
                We&apos;ll update this page if our practices change. The
                effective date at the top reflects the latest version.
                Material changes will be communicated via the app or via email
                before they take effect.
              </p>

              <H2>13. Contact</H2>
              <p>
                Questions, requests, or concerns about your data? Email{" "}
                <a href="mailto:nirv@fitfo.app">nirv@fitfo.app</a>. We
                read every message and respond within one business day.
              </p>
            </Prose>
          </article>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        space-y-4 text-[14px] leading-[1.7] text-[var(--text-secondary)]
        [&_strong]:text-[var(--text-primary)]
        [&_a]:text-[var(--primary-bright)] [&_a]:underline [&_a]:underline-offset-2
        [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-[var(--primary)]
        [&_li]:pl-1
        [&_em]:not-italic [&_em]:text-[var(--text-primary)]
      "
    >
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-10 scroll-mt-24 text-xl font-bold tracking-[-0.015em] text-[var(--text-primary)] sm:text-2xl"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="mt-6 text-base font-bold tracking-[-0.005em] text-[var(--text-primary)]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {children}
    </h3>
  );
}
