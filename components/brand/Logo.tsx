import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { BUBBLE_PATH, CHECK_PATH, CHECK_WIDTH, GLYPH_OFFSET, LOGO_CANVAS, LOGO_COLORS, SUN, SUN_GAP, TILE_RADIUS } from './logo-geometry';

export interface LogoProps {
  size: number;
  /** Spoken name; omit when the logo sits next to the app name. */
  accessibilityLabel?: string;
}

/** The app mark on its coral tile, identical to the app icon and splash image. */
export function Logo({ size, accessibilityLabel }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${LOGO_CANVAS} ${LOGO_CANVAS}`}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Rect width={LOGO_CANVAS} height={LOGO_CANVAS} rx={TILE_RADIUS} fill={LOGO_COLORS.coral} />
      <G transform={`translate(${GLYPH_OFFSET.x} ${GLYPH_OFFSET.y})`}>
        <Path d={BUBBLE_PATH} fill={LOGO_COLORS.bubble} />
        <Path d={CHECK_PATH} fill="none" stroke={LOGO_COLORS.check} strokeWidth={CHECK_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={SUN.cx} cy={SUN.cy} r={SUN.r + SUN_GAP} fill={LOGO_COLORS.coral} />
        <Circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill={LOGO_COLORS.sun} />
      </G>
    </Svg>
  );
}
