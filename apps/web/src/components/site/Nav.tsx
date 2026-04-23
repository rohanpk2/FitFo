import Image from "next/image";
import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-soft)] bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
        <Link
          href="/"
          aria-label="FitFo home"
          className="flex items-center"
        >
          {/* The logo PNG already contains built-in padding plus the "fitfo" */}
          {/* wordmark, so we let it render large inside a tight-height nav. */}
          <Image
            src="/fitfo-logo.png"
            alt="FitFo"
            width={96}
            height={96}
            className="h-12 w-12 sm:h-14 sm:w-14"
            priority
          />
        </Link>

        <nav className="flex items-center gap-0.5 text-[13px] font-medium text-[var(--text-secondary)] sm:gap-1.5">
          <Link
            href="/support"
            className="hidden rounded-full px-3 py-1 transition hover:bg-[var(--surface)] hover:text-[var(--text-primary)] sm:inline-block"
          >
            Support
          </Link>
          <Link
            href="/privacy"
            className="hidden rounded-full px-3 py-1 transition hover:bg-[var(--surface)] hover:text-[var(--text-primary)] sm:inline-block"
          >
            Privacy
          </Link>
          <Link
            href="/marketing"
            className="hidden rounded-full px-3 py-1 transition hover:bg-[var(--surface)] hover:text-[var(--text-primary)] md:inline-block"
          >
            Press
          </Link>
          <a
            href="mailto:nirv@fitfo.app"
            className="ml-1 rounded-full bg-[var(--primary)] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,90,20,0.6)] transition hover:bg-[var(--primary-bright)]"
          >
            Download Now
          </a>
        </nav>
      </div>
    </header>
  );
}
