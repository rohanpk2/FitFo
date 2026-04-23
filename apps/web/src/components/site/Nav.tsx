import Image from "next/image";
import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-soft)] bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link
          href="/"
          aria-label="FitFo home"
          className="flex items-center gap-2.5"
        >
          <Image
            src="/fitfo-logo.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
            priority
          />
          <span
            className="text-[15px] font-bold tracking-[-0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            fitfo
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)] sm:gap-2">
          <Link
            href="/support"
            className="hidden rounded-full px-3 py-1.5 transition hover:bg-[var(--surface)] hover:text-[var(--text-primary)] sm:inline-block"
          >
            Support
          </Link>
          <Link
            href="/privacy"
            className="hidden rounded-full px-3 py-1.5 transition hover:bg-[var(--surface)] hover:text-[var(--text-primary)] sm:inline-block"
          >
            Privacy
          </Link>
          <Link
            href="/marketing"
            className="hidden rounded-full px-3 py-1.5 transition hover:bg-[var(--surface)] hover:text-[var(--text-primary)] md:inline-block"
          >
            Press
          </Link>
          <a
            href="mailto:nirv@fitfo.app"
            className="ml-1 rounded-full bg-[var(--primary)] px-4 py-2 text-[13px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,90,20,0.6)] transition hover:bg-[var(--primary-bright)]"
          >
            Get Early Access
          </a>
        </nav>
      </div>
    </header>
  );
}
