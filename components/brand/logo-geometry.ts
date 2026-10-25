/**
 * The Chèque du jour mark: a speech bubble (conversation) holding a check mark
 * (the "chèque" pun) with a small sun (something new every day). Drawn on a
 * 1024 × 1024 canvas. Shared by the in-app <Logo /> and scripts/build-brand.ts,
 * so the app icon and the screens always match.
 */

export const LOGO_CANVAS = 1024;

export const LOGO_COLORS = {
  coral: '#F26B5B',
  bubble: '#FFFFFF',
  check: '#1B2440',
  sun: '#F7C948',
} as const;

/** Rounded bubble with a tail at the bottom left. */
export const BUBBLE_PATH =
  'M 382 300 H 642 A 110 110 0 0 1 752 410 V 550 A 110 110 0 0 1 642 660 H 480 L 330 770 L 382 660 A 110 110 0 0 1 272 550 V 410 A 110 110 0 0 1 382 300 Z';

export const CHECK_PATH = 'M 400 478 L 478 556 L 628 406';
export const CHECK_WIDTH = 62;

export const SUN = { cx: 748, cy: 304, r: 74 } as const;
/** Ring around the sun in the background colour, separating it from the bubble. */
export const SUN_GAP = 22;

/** Moves the glyph's visual centre to the canvas centre. */
export const GLYPH_OFFSET = { x: -35, y: 12 } as const;

/** Corner radius of the rounded-square app tile at full canvas size. */
export const TILE_RADIUS = 232;
