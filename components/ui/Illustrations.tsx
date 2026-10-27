/**
 * Simple original flat illustrations for the Learn tiles, drawn in SVG.
 */
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

interface IllustrationProps {
  size?: number;
  ink: string;
  paper: string;
}

/** Stacked books — Grammar. */
export function BooksIllustration({ size = 96, ink, paper }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <G>
        <Rect x="14" y="62" width="64" height="14" rx="4" fill={paper} />
        <Rect x="14" y="62" width="10" height="14" rx="3" fill={ink} opacity={0.35} />
        <Rect x="20" y="46" width="58" height="14" rx="4" fill={paper} opacity={0.85} />
        <Rect x="66" y="46" width="8" height="14" rx="3" fill={ink} opacity={0.3} />
        <Rect x="10" y="30" width="60" height="14" rx="4" fill={paper} />
        <Rect x="16" y="35" width="34" height="4" rx="2" fill={ink} opacity={0.35} />
        <Path d="M70 14 l6 10 h-12 z" fill={paper} opacity={0.9} />
      </G>
    </Svg>
  );
}

/** Speech bubbles — Vocabulary. */
export function BubblesIllustration({ size = 96, ink, paper }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M14 22 h46 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 h-26 l-12 10 v-10 h-8 a10 10 0 0 1 -10 -10 v-18 a10 10 0 0 1 10 -10z" fill={paper} />
      <Rect x="22" y="34" width="30" height="5" rx="2.5" fill={ink} opacity={0.35} />
      <Rect x="22" y="44" width="20" height="5" rx="2.5" fill={ink} opacity={0.25} />
      <Path d="M58 46 h22 a8 8 0 0 1 8 8 v12 a8 8 0 0 1 -8 8 h-4 v8 l-10 -8 h-8 a8 8 0 0 1 -8 -8 v-12 a8 8 0 0 1 8 -8z" fill={paper} opacity={0.75} />
      <Circle cx="64" cy="60" r="2.5" fill={ink} opacity={0.4} />
      <Circle cx="72" cy="60" r="2.5" fill={ink} opacity={0.4} />
      <Circle cx="80" cy="60" r="2.5" fill={ink} opacity={0.4} />
    </Svg>
  );
}

/** Headphones and a check — Tests. */
export function HeadphonesIllustration({ size = 96, ink, paper }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M20 56 v-8 a28 28 0 0 1 56 0 v8" stroke={paper} strokeWidth="7" fill="none" strokeLinecap="round" />
      <Rect x="12" y="52" width="18" height="26" rx="8" fill={paper} />
      <Rect x="66" y="52" width="18" height="26" rx="8" fill={paper} />
      <Circle cx="48" cy="66" r="12" fill={paper} opacity={0.85} />
      <Path d="M42 66 l4 4 l8 -9" stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
    </Svg>
  );
}
