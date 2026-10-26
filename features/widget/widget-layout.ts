/**
 * Text and spacing for the word widget at the size the launcher reports (in dp). The
 * design is drawn for the default 3×2 widget; a bigger widget scales everything up by
 * the tighter of its width and height ratios, so text grows without overflowing. The
 * French word is also capped by its length, so a long expression stays on one line.
 */
export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetLayout {
  label: number;
  word: number;
  detail: number;
  english: number;
  englishLines: number;
  padding: number;
  gap: number;
  /** Diameter of the pronunciation button in the top-right corner, and its inset. */
  button: number;
  buttonInset: number;
}

/** The size the base layout is designed for: the widget's minimum in app.json. */
export const WIDGET_BASE_SIZE: WidgetSize = { width: 180, height: 110 };
const MAX_SCALE = 2.5;
/** Width that one more unit of scale needs: text lines run wider than the base design. */
const WIDTH_PER_SCALE = 150;
/** Average glyph width of the bold word, as a share of its font size. */
const GLYPH_WIDTH = 0.58;

export function widgetLayout({ width, height }: WidgetSize, word = ''): WidgetLayout {
  const ratio = Math.min(width / WIDTH_PER_SCALE, height / WIDGET_BASE_SIZE.height);
  const scale = Math.min(MAX_SCALE, Math.max(1, Number.isFinite(ratio) ? ratio : 1));
  const px = (n: number): number => Math.round(n * scale);
  // Extra height beyond what the scaled text needs goes to more lines of English.
  const tallness = height / (WIDGET_BASE_SIZE.height * scale);
  const padding = Math.round(16 * Math.min(scale, 1.5));
  const fitsWidth = word ? Math.floor((width - 2 * padding) / (word.length * GLYPH_WIDTH)) : Infinity;
  return {
    label: px(11),
    word: Math.max(24, Math.min(px(24), fitsWidth)),
    detail: px(13),
    english: px(15),
    englishLines: tallness >= 1.8 ? 4 : tallness >= 1.45 ? 3 : 2,
    padding,
    gap: px(4),
    button: Math.min(64, px(36)),
    buttonInset: Math.min(16, px(8)),
  };
}
