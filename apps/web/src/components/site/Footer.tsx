import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-soft)] bg-[var(--bg)]">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/fitfo-logo.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span
                className="text-base font-bold tracking-[-0.02em] text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                fitfo
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)] text-pretty">
              Turn the fitness videos you scroll past into workouts you can
              actually follow. Built for people who train.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterCol
              title="Product"
              links={[
                { label: "Home", href: "/" },
                { label: "Press kit", href: "/marketing" },
              ]}
            />
            <FooterCol
              title="Support"
              links={[
                { label: "Help center", href: "/support" },
                { label: "Contact", href: "mailto:nirv@fitfo.app" },
              ]}
            />
            <FooterCol
              title="Legal"
              links={[
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/marketing#terms" },
              ]}
            />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--border-soft)] pt-6 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Vaayu Athletics LLC. All rights reserved.</p>
          <p>
            Questions?{" "}
            <a
              href="mailto:nirv@fitfo.app"
              className="text-[var(--primary-bright)] hover:underline"
            >
              nirv@fitfo.app
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4
        className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--primary-bright)]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {title}
      </h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
