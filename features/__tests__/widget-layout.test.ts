import { WIDGET_BASE_SIZE, widgetLayout } from '../widget/widget-layout';

describe('word widget layout', () => {
  it('uses the base sizes at the default 3×2 size and below', () => {
    const base = widgetLayout(WIDGET_BASE_SIZE);
    expect(base).toMatchObject({ label: 11, word: 24, detail: 13, english: 15, padding: 16, englishLines: 2 });
    expect(widgetLayout({ width: 120, height: 80 })).toEqual(base);
    expect(widgetLayout({ width: 0, height: 0 })).toEqual(base);
  });

  it('grows the text with the widget, limited by the tighter side', () => {
    // A 4×4-ish widget (about 358 × 339 dp on a 6.7" phone) more than doubles the text.
    const big = widgetLayout({ width: 358, height: 339 }, 'se lever');
    expect(big.word).toBeGreaterThanOrEqual(55);
    expect(big.english).toBeGreaterThanOrEqual(34);
    // Wide but short: height decides, so nothing overflows.
    expect(widgetLayout({ width: 400, height: 110 }).word).toBe(24);
    // Tall but narrow: width decides.
    expect(widgetLayout({ width: 180, height: 400 }).word).toBe(29);
  });

  it('keeps a long word on one line by capping its size to the width', () => {
    const long = widgetLayout({ width: 358, height: 339 }, "s'il vous plaît, répétez");
    expect(long.word).toBeLessThan(widgetLayout({ width: 358, height: 339 }, 'chat').word);
    expect(long.word).toBeGreaterThanOrEqual(24);
  });

  it('stops growing at a readable maximum and gives the English more lines when tall', () => {
    expect(widgetLayout({ width: 1000, height: 1000 }, 'chat').word).toBe(60);
    expect(widgetLayout({ width: 360, height: 700 }).englishLines).toBe(4);
  });
});
