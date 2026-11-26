/**
 * Text and spacing for the daily widget (word, sentence and verb stacked) at the size the
 * launcher reports, in dp. The design is drawn for the default 4×3 widget; a bigger
 * widget scales everything up by the tighter of its width and height ratios, so text
 * grows without overflowing, and spare height buys the sentence and translations a
 * second line. A short widget (one placed at the old 3×2 size) shows one line per item.
 */
export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetLayout {
  /** One line per item, without labels or translations. */
  compact: boolean;
  label: number;
  /** The French text of each item. */
  fr: number;
  /** Translation and details under the French. */
  sub: number;
  frLines: number;
  subLines: number;
  padding: number;
  /** Space around the dividers between items. */
  gap: number;
  /** Diameter of each item's pronunciation button. */
  button: number;
}

/** The size the base layout is designed for: the widget's minimum in app.json. */
export const WIDGET_BASE_SIZE: WidgetSize = { width: 250, height: 180 };
/** Below this height the three items only fit as single lines. */
const COMPACT_BELOW = 170;
/** fr grows from 16 to at most 26. */
const MAX_SCALE = 26 / 16;
/** Extra height (relative to the scaled design) that earns second lines. */
const TALL = 1.4;

const COMPACT: WidgetLayout = { compact: true, label: 0, fr: 14, sub: 0, frLines: 1, subLines: 0, padding: 10, gap: 3, button: 24 };

export function widgetLayout({ width, height }: WidgetSize): WidgetLayout {
  if (!(height >= COMPACT_BELOW)) return COMPACT;
  const ratio = Math.min(width / WIDGET_BASE_SIZE.width, height / WIDGET_BASE_SIZE.height);
  const scale = Math.min(MAX_SCALE, Math.max(1, Number.isFinite(ratio) ? ratio : 1));
  const px = (n: number): number => Math.round(n * scale);
  const tall = height / (WIDGET_BASE_SIZE.height * scale) >= TALL;
  return {
    compact: false,
    label: px(10),
    fr: px(16),
    sub: px(12),
    frLines: tall ? 2 : 1,
    subLines: tall ? 2 : 1,
    padding: Math.round(14 * Math.min(scale, 1.3)),
    gap: px(5),
    button: Math.min(48, px(30)),
  };
}
