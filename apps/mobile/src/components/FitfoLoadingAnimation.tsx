import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
} from "react-native-svg";

import { getTheme, type ThemeMode } from "../theme";

const ORANGE = "#FF5A14";
const ORANGE_HI = "#FF6A2C";
const BG = "#000000";
const DURATION = 2400;
const HOLD = 900;
const FADE = 600;
const LOOP = DURATION + HOLD + FADE;
const SPARK_COUNT = 10;

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

interface SparkState {
  bornAt: number;
  lifetime: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r0: number;
}

const { segs, total } = polyLengths(PTS);
const fullPath = `M ${PTS.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
const SQUIRCLE_PATH = squircle(1024);

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
  const corePathRef = useRef<Path>(null);
  const headRef = useRef<Circle>(null);
  const apexRef = useRef<Circle>(null);
  const sparkRefs = useRef<Array<Circle | null>>([]);
  const sparks = useMemo<SparkState[]>(
    () =>
      Array.from({ length: SPARK_COUNT }, () => ({
        bornAt: -1,
        lifetime: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r0: 0,
      })),
    [],
  );

  useEffect(() => {
    let raf = 0;
    let start = Date.now();
    let lastSpark = 0;

    const spawn = (now: number, x: number, y: number) => {
      const spark = sparks.find((s) => now > s.bornAt + s.lifetime);
      if (!spark) return;
      spark.bornAt = now;
      spark.lifetime = 400 + Math.random() * 300;
      spark.x = x + (Math.random() - 0.5) * 16;
      spark.y = y + (Math.random() - 0.5) * 16;
      spark.vx = (Math.random() - 0.5) * 0.4;
      spark.vy = (Math.random() - 0.2) * 0.4 - 0.2;
      spark.r0 = 3 + Math.random() * 5;
    };

    const updateSparks = (now: number) => {
      sparks.forEach((spark, index) => {
        const node = sparkRefs.current[index];
        if (!node || spark.bornAt < 0) return;
        const age = now - spark.bornAt;
        if (age > spark.lifetime) {
          node.setNativeProps({ opacity: 0 });
          return;
        }
        const t = age / spark.lifetime;
        const x = spark.x + spark.vx * age;
        const y = spark.y + spark.vy * age + 0.0008 * age * age;
        const r = spark.r0 * (1 - t);
        const opacity = 1 - t;
        node.setNativeProps({ cx: x, cy: y, r, opacity });
      });
    };

    const frame = () => {
      const now = Date.now();
      let elapsed = now - start;
      if (elapsed > LOOP) {
        start = now;
        elapsed = 0;
      }

      if (elapsed <= DURATION) {
        const t = elapsed / DURATION;
        const distance = easeInOutCubic(t) * total;
        const d = pathUpTo(distance);
        const point = pointAt(distance);
        corePathRef.current?.setNativeProps({ d, opacity: 1 });
        headRef.current?.setNativeProps({
          cx: point.x,
          cy: point.y,
          opacity: Math.min(1, t * 8),
        });
        apexRef.current?.setNativeProps({ opacity: 0 });
        if (now - lastSpark > 40) {
          spawn(now, point.x, point.y);
          lastSpark = now;
        }
      } else if (elapsed <= DURATION + HOLD) {
        const endPoint = PTS[PTS.length - 1];
        const holdT = (elapsed - DURATION) / HOLD;
        corePathRef.current?.setNativeProps({ d: pathUpTo(total), opacity: 1 });
        headRef.current?.setNativeProps({ opacity: 0 });
        apexRef.current?.setNativeProps({ opacity: 1 });
        if (holdT < 0.15 && now - lastSpark > 20) {
          spawn(now, endPoint.x, endPoint.y);
          lastSpark = now;
        }
      } else {
        const fadeT = (elapsed - DURATION - HOLD) / FADE;
        const opacity = Math.max(0, 1 - fadeT);
        corePathRef.current?.setNativeProps({ opacity });
        headRef.current?.setNativeProps({ opacity: 0 });
        apexRef.current?.setNativeProps({ opacity });
      }

      updateSparks(now);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sparks]);

  const radius = size * 0.2237;

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
            <ClipPath id="fitfo-clip">
              <Path d={SQUIRCLE_PATH} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#fitfo-clip)">
            <Rect x={0} y={0} width={1024} height={1024} fill={BG} />
            <Path
              d={fullPath}
              fill="none"
              stroke={ORANGE}
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeOpacity={0.06}
              strokeWidth={88}
            />
            <Path
              ref={corePathRef}
              d=""
              fill="none"
              stroke={ORANGE}
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeWidth={88}
            />
            {sparks.map((_, index) => (
              <Circle
                key={index}
                ref={(node) => {
                  sparkRefs.current[index] = node;
                }}
                cx={0}
                cy={0}
                fill={ORANGE}
                opacity={0}
                r={0}
              />
            ))}
            <Circle
              ref={headRef}
              cx={0}
              cy={0}
              fill={ORANGE_HI}
              opacity={0}
              r={36}
            />
            <Circle
              ref={apexRef}
              cx={PTS[PTS.length - 1].x}
              cy={PTS[PTS.length - 1].y}
              fill={ORANGE_HI}
              opacity={0}
              r={36}
            />
          </G>
        </Svg>
      </View>
      {caption ? (
        <Text
          style={[
            styles.caption,
            { color: theme.colors.textMuted },
          ]}
        >
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
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  captionAccent: {
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
  return PTS[PTS.length - 1];
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
