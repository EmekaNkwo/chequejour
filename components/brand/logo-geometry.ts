/**
 * The Chaque Jour mark: a tear-off day-calendar page (chaque jour: every day) with a
 * French blue-white-red header, a bold "J" for Jour, and a speech-bubble tail at the
 * bottom corner (a language you speak). Drawn on a 1024 × 1024 canvas on the navy
 * tile. Shared by the in-app <Logo /> and scripts/build-brand.ts, so the app icon and
 * the screens always match.
 */

export const LOGO_CANVAS = 1024;

export const LOGO_COLORS = {
  tile: '#1B2440',
  page: '#FFFFFF',
  blue: '#2F5BD3',
  red: '#F26B5B',
  ink: '#1B2440',
  ring: '#C9D2E6',
} as const;

const PAGE = { left: 262, right: 762, top: 300, bottom: 780, radius: 72 } as const;
const R = PAGE.radius;

/** The page with its speech-bubble tail at the bottom left. */
export const PAGE_PATH = [
  `M ${PAGE.left + R} ${PAGE.top}`,
  `H ${PAGE.right - R}`,
  `A ${R} ${R} 0 0 1 ${PAGE.right} ${PAGE.top + R}`,
  `V ${PAGE.bottom - R}`,
  `A ${R} ${R} 0 0 1 ${PAGE.right - R} ${PAGE.bottom}`,
  `H 450 L 300 884 L 348 ${PAGE.bottom}`,
  `H ${PAGE.left + R}`,
  `A ${R} ${R} 0 0 1 ${PAGE.left} ${PAGE.bottom - R}`,
  `V ${PAGE.top + R}`,
  `A ${R} ${R} 0 0 1 ${PAGE.left + R} ${PAGE.top}`,
  'Z',
].join(' ');

const BAND_BOTTOM = 436;
const THIRD = (PAGE.right - PAGE.left) / 3;

/** Header stripes, left to right: blue, white (the page shows through), red. */
export const BAND_BLUE_PATH = `M ${PAGE.left + R} ${PAGE.top} H ${PAGE.left + THIRD} V ${BAND_BOTTOM} H ${PAGE.left} V ${PAGE.top + R} A ${R} ${R} 0 0 1 ${PAGE.left + R} ${PAGE.top} Z`;
export const BAND_RED_PATH = `M ${PAGE.right - THIRD} ${PAGE.top} H ${PAGE.right - R} A ${R} ${R} 0 0 1 ${PAGE.right} ${PAGE.top + R} V ${BAND_BOTTOM} H ${PAGE.right - THIRD} Z`;

/** The tear line under the header. */
export const TEAR_LINE = { x1: PAGE.left, x2: PAGE.right, y: BAND_BOTTOM + 6, width: 12 } as const;

/** Binding rings above the page. */
export const RINGS = [
  { x: 372, y: 246, width: 48, height: 112 },
  { x: 604, y: 246, width: 48, height: 112 },
] as const;

/** The "J": top bar, stem and hook, drawn as one round-capped stroke. */
export const J_PATH = 'M 480 516 H 600 M 568 516 V 632 A 78 78 0 0 1 412 632';
export const J_WIDTH = 68;

/** Moves the glyph's visual centre to the canvas centre. */
export const GLYPH_OFFSET = { x: 0, y: -52 } as const;

/** Corner radius of the rounded-square app tile at full canvas size. */
export const TILE_RADIUS = 232;

/** The glyph as SVG markup, used by the build script and checked by tests. */
export function glyphMarkup(): string {
  const rings = RINGS.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.width / 2}" fill="${LOGO_COLORS.ring}"/>`).join('');
  return [
    `<path d="${PAGE_PATH}" fill="${LOGO_COLORS.page}"/>`,
    `<path d="${BAND_BLUE_PATH}" fill="${LOGO_COLORS.blue}"/>`,
    `<path d="${BAND_RED_PATH}" fill="${LOGO_COLORS.red}"/>`,
    `<line x1="${TEAR_LINE.x1}" y1="${TEAR_LINE.y}" x2="${TEAR_LINE.x2}" y2="${TEAR_LINE.y}" stroke="${LOGO_COLORS.tile}" stroke-width="${TEAR_LINE.width}" stroke-dasharray="4 26" stroke-linecap="round"/>`,
    rings,
    `<path d="${J_PATH}" fill="none" stroke="${LOGO_COLORS.ink}" stroke-width="${J_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`,
  ].join('');
}

/**
 * Single-colour version (Android themed icon, notification icon): only alpha counts,
 * so the stripes go and the J and tear line are cut out of the page.
 */
export function silhouetteMaskMarkup(): string {
  const rings = RINGS.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.width / 2}" fill="white"/>`).join('');
  return [
    `<path d="${PAGE_PATH}" fill="white"/>`,
    `<line x1="${TEAR_LINE.x1}" y1="${TEAR_LINE.y}" x2="${TEAR_LINE.x2}" y2="${TEAR_LINE.y}" stroke="black" stroke-width="${TEAR_LINE.width}" stroke-dasharray="4 26" stroke-linecap="round"/>`,
    rings,
    `<path d="${J_PATH}" fill="none" stroke="black" stroke-width="${J_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`,
  ].join('');
}
