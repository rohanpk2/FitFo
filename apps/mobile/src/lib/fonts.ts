import React, { type ReactElement } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
} from "react-native";

// ─── Font family tokens ────────────────────────────────────────────────────
//
// Body — Satoshi (Fontshare), clean modern grotesk. Handles all UI chrome,
// labels, buttons, copy. Loaded in App.tsx via expo-font.
//
// Display — Clash Display (Fontshare), editorial display type for hero
// headlines and brand moments.
//
// Satoshi only ships 300/400/500/700/900, so extraBold (800) and semiBold
// (600) get mapped to the nearest available weight.

export const F = {
  display:         "ClashDisplay-Semibold",
  displayMedium:   "ClashDisplay-Medium",
  displayLight:    "ClashDisplay-Medium",

  black:           "Satoshi-Black",
  extraBold:       "Satoshi-Bold",   // Satoshi has no 800; use 700.
  bold:            "Satoshi-Bold",
  semiBold:        "Satoshi-Medium", // Satoshi has no 600; use 500.
  medium:          "Satoshi-Medium",
  regular:         "Satoshi-Regular",

  condensedBlack:  "ClashDisplay-Semibold",
  condensedBold:   "ClashDisplay-Medium",
} as const;

// ─── Font weight → Satoshi family map ──────────────────────────────────────
//
// Custom TTFs in React Native do NOT auto-synthesize weights — setting
// `fontWeight: "900"` on a style that uses "Satoshi-Regular" keeps the same
// thin strokes. We have to pick the right family per weight.

const WEIGHT_TO_FAMILY: Record<string, string> = {
  "100": "Satoshi-Regular",
  "200": "Satoshi-Regular",
  "300": "Satoshi-Regular",
  "400": "Satoshi-Regular",
  "500": "Satoshi-Medium",
  "600": "Satoshi-Medium",  // No 600; collapse to 500.
  "700": "Satoshi-Bold",
  "800": "Satoshi-Bold",    // No 800; collapse to 700.
  "900": "Satoshi-Black",
  normal: "Satoshi-Regular",
  bold: "Satoshi-Bold",
};

function resolveFontFamily(style: unknown): string | undefined {
  if (!style) {
    return "Satoshi-Regular";
  }
  const flattened = StyleSheet.flatten(
    style as TextStyle | TextStyle[] | null | undefined,
  ) as TextStyle | undefined;
  if (!flattened) {
    return "Satoshi-Regular";
  }
  // Honor explicit fontFamily — this is how callers opt into Clash Display
  // via F.display, or into any icon / system font they deliberately picked.
  if (flattened.fontFamily) {
    return undefined;
  }
  const weight = flattened.fontWeight
    ? String(flattened.fontWeight)
    : "400";
  return WEIGHT_TO_FAMILY[weight] || "Satoshi-Regular";
}

function patchComponent(component: unknown): void {
  const target = component as { render?: (...args: unknown[]) => unknown };
  const originalRender = target.render;
  if (typeof originalRender !== "function") {
    return;
  }
  try {
    // RN New Architecture / React 19: `render` may be a non-configurable accessor.
    // Throwing here during App load prevents `main` registration and crashes the bundle.
    target.render = function patchedRender(...args: unknown[]) {
      const origin = originalRender.apply(this, args) as ReactElement<{ style?: unknown }> | null;
      if (!origin || typeof origin !== "object" || !("props" in origin)) {
        return origin;
      }
      const originalStyle = origin.props.style;
      const family = resolveFontFamily(originalStyle);
      if (!family) {
        return origin;
      }
      return React.cloneElement(origin, {
        style: [{ fontFamily: family }, originalStyle],
      });
    };
  } catch {
    // Fall back to defaultProps only below (often all that survives on Fabric).
  }
}

function applyDefaultPropsFallback(component: unknown): void {
  try {
    const target = component as {
      defaultProps?: { style?: unknown };
    };
    target.defaultProps = target.defaultProps || {};
    const prev = target.defaultProps.style;
    target.defaultProps.style = prev
      ? [{ fontFamily: "Satoshi-Regular" }, prev]
      : { fontFamily: "Satoshi-Regular" };
  } catch {
    // React 19 + Fabric: legacy defaultProps mutate may be blocked; explicit `fontFamily` in styles still applies.
  }
}

let applied = false;

function shouldSkipGlobalTextPatch(): boolean {
  const g = globalThis as { nativeFabricUIManager?: unknown };
  // RN New Architecture: host `Text` / `TextInput` are sealed; assigning
  // `.render` or mutating `.defaultProps` can throw Hermes-side and abort the
  // whole bundle (`"main" has not been registered`), even though strict-mode JS
  // assignment usually surfaces as a caught TypeError — skip patching entirely on Fabric.
  return typeof g.nativeFabricUIManager !== "undefined";
}

/**
 * Best-effort global Satoshi mapping: patches `Text` / `TextInput` on legacy
 * (Paper) when the runtime allows it. Skipped entirely on Fabric (New
 * Architecture) — rely on explicit `fontFamily` (typically `F.*` from this module).
 */
export function applyDefaultFont(): void {
  if (applied) {
    return;
  }
  applied = true;
  if (shouldSkipGlobalTextPatch()) {
    return;
  }
  patchComponent(Text);
  patchComponent(TextInput);
  applyDefaultPropsFallback(Text);
  applyDefaultPropsFallback(TextInput);
}
