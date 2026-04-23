"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";

type RevealVariant = "up" | "scale";

interface RevealProps {
  children: ReactNode;
  /** Delay in ms before this element animates. Useful for staggering siblings. */
  delay?: number;
  /** Which entrance shape to use , plain translate (`up`) or translate + scale (`scale`). */
  variant?: RevealVariant;
  /** Element tag to render , defaults to `div`. */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

/**
 * Fade + slide element into view when it enters the viewport. Uses a single
 * IntersectionObserver per instance, unsubscribes after the first trigger so
 * scrolling back up doesn't re-animate. Matches the shared easing + duration
 * defined in globals.css so every reveal on the site feels cohesive.
 *
 * Marked "use client" , the rest of the page stays a server component, but
 * this small island hydrates for the observer wiring.
 */
export function Reveal({
  children,
  delay = 0,
  variant = "up",
  as: Component = "div",
  className = "",
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect reduced motion , flip to the final state immediately so users
    // still see the content.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        // Fire slightly before the element hits the edge so animations line up
        // with scroll momentum and feel responsive rather than late.
        threshold: 0.12,
        rootMargin: "0px 0px -64px 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const variantClass = variant === "scale" ? "reveal-scale" : "reveal-up";
  const classes = [
    "reveal",
    variantClass,
    inView ? "in-view" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component
      ref={ref as React.RefObject<HTMLElement>}
      className={classes}
      style={{
        ...style,
        transitionDelay: delay ? `${delay}ms` : undefined,
      }}
    >
      {children}
    </Component>
  );
}
