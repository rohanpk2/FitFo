import Image from "next/image";
import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-(--bg)/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
        <Link
          href="/"
          aria-label="Fitfo home"
          className="flex items-center"
        >
          <Image
            src="/fitfo-logo.png"
            alt="Fitfo"
            width={512}
            height={512}
            className="h-12 w-12 sm:h-14 sm:w-14"
            priority
          />
        </Link>

        <nav className="flex items-center gap-0.5 text-[13px] font-medium text-text-secondary sm:gap-1.5">
          <Link
            href="/support"
            className="hidden rounded-full px-3 py-1 transition hover:bg-surface hover:text-text-primary sm:inline-block"
          >
            Support
          </Link>
          <Link
            href="/privacy"
            className="hidden rounded-full px-3 py-1 transition hover:bg-surface hover:text-text-primary sm:inline-block"
          >
            Privacy
          </Link>
          <Link
            href="/marketing"
            className="hidden rounded-full px-3 py-1 transition hover:bg-surface hover:text-text-primary md:inline-block"
          >
            Press
          </Link>
          <a
            href="https://apps.apple.com/app/id6762418380"
            target="_blank"
            rel="noreferrer"
            className="ml-1 rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,90,20,0.6)] transition hover:bg-primary-bright"
          >
            Download Now
          </a>
        </nav>
      </div>
    </header>
  );
}
