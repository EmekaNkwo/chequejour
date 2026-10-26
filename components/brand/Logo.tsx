import { SvgXml } from 'react-native-svg';
import { glyphMarkup, GLYPH_OFFSET, LOGO_CANVAS, LOGO_COLORS, TILE_RADIUS } from './logo-geometry';

const XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_CANVAS} ${LOGO_CANVAS}">
  <rect width="${LOGO_CANVAS}" height="${LOGO_CANVAS}" rx="${TILE_RADIUS}" fill="${LOGO_COLORS.tile}"/>
  <g transform="translate(${GLYPH_OFFSET.x} ${GLYPH_OFFSET.y})">${glyphMarkup()}</g>
</svg>`;

export interface LogoProps {
  size: number;
  /** Spoken name; omit when the logo sits next to the app name. */
  accessibilityLabel?: string;
}

/** The app mark on its navy tile, identical to the app icon and splash image. */
export function Logo({ size, accessibilityLabel }: LogoProps) {
  return (
    <SvgXml
      xml={XML}
      width={size}
      height={size}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
