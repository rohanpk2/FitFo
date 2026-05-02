import { useEffect, useId, useRef, useState } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
} from "react-native-svg";

import { F } from "../lib/fonts";
import { getTheme, type ThemeMode } from "../theme";

const DURATION = 2400;
const HOLD = 900;
const FADE = 600;
const LOOP = DURATION + HOLD + FADE;

const PTS = [
  { x: 190, y: 720 },
  { x: 430, y: 470 },
  { x: 560, y: 600 },
  { x: 834, y: 310 },
] as const;

type Point = (typeof PTS)[number];

interface Segment {
  from: Point;
  to: Point;
  len: number;
  start: number;
}

const { segs, total } = polyLengths(PTS);
const fullPath = `M ${PTS.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
const SQUIRCLE_PATH = squircle(1024);
const APEX = PTS[PTS.length - 1];

interface Frame {
  d: string;
  pathOpacity: number;
  headX: number;
  headY: number;
  headOpacity: number;
  apexOpacity: number;
}

function computeFrame(elapsed: number): Frame {
  if (elapsed <= DURATION) {
    const t = elapsed / DURATION;
    const distance = easeInOutCubic(t) * total;
    const point = pointAt(distance);
    return {
      d: pathUpTo(distance),
      pathOpacity: 1,
      headX: point.x,
      headY: point.y,
      headOpacity: Math.min(1, t * 8),
      apexOpacity: 0,
    };
  }
  if (elapsed <= DURATION + HOLD) {
    return {
      d: pathUpTo(total),
      pathOpacity: 1,
      headX: APEX.x,
      headY: APEX.y,
      headOpacity: 0,
      apexOpacity: 1,
    };
  }
  const fadeT = (elapsed - DURATION - HOLD) / FADE;
  const opacity = Math.max(0, 1 - fadeT);
  return {
    d: pathUpTo(total),
    pathOpacity: opacity,
    headX: APEX.x,
    headY: APEX.y,
    headOpacity: 0,
    apexOpacity: opacity,
  };
}

interface FitfoLoadingAnimationProps {
  caption?: string | null;
  label?: string;
  size?: number;
  style?: ViewStyle;
  themeMode?: ThemeMode;
}

export function FitfoLoadingAnimation({
  caption = "loading",
  label = "Fitfo is loading",
  size = 144,
  style,
  themeMode = "dark",
}: FitfoLoadingAnimationProps) {
  const theme = getTheme(themeMode);
  const reactId = useId();
  const clipId = `fitfo-clip-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [frame, setFrame] = useState<Frame>(() => computeFrame(0));
  const startRef = useRef<number>(Date.now());
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    let raf = 0;
    startRef.current = Date.now();

    const tick = () => {
      const now = Date.now();
      const elapsed = (now - startRef.current) % LOOP;
      // Throttle React state updates to ~30fps; keeps GC light and the
      // animation perfectly smooth visually.
      if (now - lastUpdateRef.current >= 33) {
        lastUpdateRef.current = now;
        setFrame(computeFrame(elapsed));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const radius = size * 0.2237;
  const markBackground = theme.mode === "dark" ? "#000000" : theme.colors.surface;

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      style={[styles.wrap, style]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
        }}
      >
        <Svg viewBox="0 0 1024 1024" width={size} height={size}>
          <Defs>
            <ClipPath id={clipId}>
              <Path d={SQUIRCLE_PATH} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            <Rect x={0} y={0} width={1024} height={1024} fill={markBackground} />
            <Path
              d={fullPath}
              fill="none"
              stroke={theme.colors.primary}
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeOpacity={0.06}
              strokeWidth={88}
            />
            <Path
              d={frame.d || `M ${PTS[0].x} ${PTS[0].y}`}
              fill="none"
              stroke={theme.colors.primary}
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeWidth={88}
              opacity={frame.pathOpacity}
            />
            <Circle
              cx={frame.headX}
              cy={frame.headY}
              fill={theme.colors.primaryBright}
              opacity={frame.headOpacity}
              r={36}
            />
            <Circle
              cx={APEX.x}
              cy={APEX.y}
              fill={theme.colors.primaryBright}
              opacity={frame.apexOpacity}
              r={36}
            />
          </G>
        </Svg>
      </View>
      {caption ? (
        <Text style={[styles.caption, { color: theme.colors.textMuted }]}>
          <Text
            style={[
              styles.captionAccent,
              { color: theme.colors.primaryBright },
            ]}
          >
            Fitfo
          </Text>
          {" · "}
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  caption: {
    fontFamily: F.bold,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  captionAccent: {
    fontFamily: F.bold,
    fontWeight: "700",
  },
});

function polyLengths(pts: readonly Point[]) {
  const next: Segment[] = [];
  let acc = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const len = Math.hypot(dx, dy);
    next.push({ from: pts[i - 1], to: pts[i], len, start: acc });
    acc += len;
  }
  return { segs: next, total: acc };
}

function pointAt(distance: number) {
  const clamped = Math.max(0, Math.min(total, distance));
  for (const seg of segs) {
    if (clamped <= seg.start + seg.len) {
      const t = (clamped - seg.start) / seg.len;
      return {
        x: seg.from.x + (seg.to.x - seg.from.x) * t,
        y: seg.from.y + (seg.to.y - seg.from.y) * t,
      };
    }
  }
  return APEX;
}

function pathUpTo(distance: number) {
  const clamped = Math.max(0, Math.min(total, distance));
  let d = `M ${PTS[0].x} ${PTS[0].y}`;
  let covered = 0;
  for (const seg of segs) {
    if (covered + seg.len <= clamped) {
      d += ` L ${seg.to.x} ${seg.to.y}`;
      covered += seg.len;
    } else {
      const remaining = clamped - covered;
      const t = remaining / seg.len;
      const x = seg.from.x + (seg.to.x - seg.from.x) * t;
      const y = seg.from.y + (seg.to.y - seg.from.y) * t;
      d += ` L ${x} ${y}`;
      break;
    }
  }
  return d;
}

function squircle(s: number) {
  const r = s * 0.2237;
  return `M ${r},0 L ${s - r},0 C ${s - r / 2.5},0 ${s},${r / 2.5} ${s},${r}
    L ${s},${s - r} C ${s},${s - r / 2.5} ${s - r / 2.5},${s} ${s - r},${s}
    L ${r},${s} C ${r / 2.5},${s} 0,${s - r / 2.5} 0,${s - r}
    L 0,${r} C 0,${r / 2.5} ${r / 2.5},0 ${r},0 Z`;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
