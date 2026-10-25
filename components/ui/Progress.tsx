import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { radii } from '../theme/tokens';
import { AppText } from './AppText';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const DURATION = 700;

/** Animates from 0 to the target once on mount, or jumps there with reduce motion. */
function useProgress(target: number) {
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(reduceMotion ? target : 0);
  useEffect(() => {
    value.value = reduceMotion ? target : withTiming(target, { duration: DURATION, easing: Easing.out(Easing.cubic) });
  }, [target, reduceMotion, value]);
  return value;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

export interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  /** Spoken label, e.g. "Today's session, 85 percent complete". */
  accessibilityLabel: string;
  showLabel?: boolean;
}

export function ProgressRing({ value, size = 76, stroke = 9, color, track, accessibilityLabel, showLabel = true }: ProgressRingProps) {
  const { colors } = useTheme();
  const pct = clamp01(value);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useProgress(pct);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? colors.primaryTint} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? colors.skills.structures.base}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showLabel ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} importantForAccessibility="no-hide-descendants">
          <AppText variant="cardTitle">{`${Math.round(pct * 100)}%`}</AppText>
        </View>
      ) : null}
    </View>
  );
}

export interface ProgressBarProps {
  value: number;
  color?: string;
  track?: string;
  height?: number;
  accessibilityLabel?: string;
}

export function ProgressBar({ value, color, track, height = 8, accessibilityLabel }: ProgressBarProps) {
  const { colors } = useTheme();
  const pct = clamp01(value);
  const progress = useProgress(pct);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.track, { height, backgroundColor: track ?? colors.primaryTint }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color ?? colors.skills.structures.base }, fill]} />
    </View>
  );
}

export interface BarChartProps {
  values: number[];
  labels: string[];
  color?: string;
  track?: string;
  height?: number;
  accessibilityLabel: string;
  highlightLast?: boolean;
}

/** Soft rounded vertical bars, e.g. the last 7 days of study minutes. */
export function BarChart({ values, labels, color, track, height = 84, accessibilityLabel, highlightLast = true }: BarChartProps) {
  const { colors } = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.chart}>
      {values.map((v, i) => (
        <View key={`${i}-${labels[i] ?? ''}`} style={styles.barColumn} importantForAccessibility="no-hide-descendants">
          <View style={[styles.barTrack, { height, backgroundColor: track ?? colors.primaryTint }]}>
            <BarFill ratio={v / max} color={highlightLast && i === values.length - 1 ? colors.primary : color ?? colors.skills.structures.base} />
          </View>
          <AppText variant="label" tone="muted">
            {labels[i]}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function BarFill({ ratio, color }: { ratio: number; color: string }) {
  const progress = useProgress(clamp01(ratio));
  const style = useAnimatedStyle(() => ({ height: `${Math.max(progress.value * 100, progress.value > 0 ? 6 : 0)}%` }));
  return <Animated.View style={[styles.barFill, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  track: { width: '100%', borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  barColumn: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { width: '100%', maxWidth: 26, borderRadius: radii.sm, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: radii.sm },
});
