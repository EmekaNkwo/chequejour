import { WIDGET_BASE_SIZE, widgetLayout } from '../widget/widget-layout';

describe('daily widget layout', () => {
  it('uses the base sizes at the default 4×3 size', () => {
    const base = widgetLayout(WIDGET_BASE_SIZE);
    expect(base).toMatchObject({ compact: false, label: 10, fr: 16, sub: 12, frLines: 1, subLines: 1, padding: 14, button: 30 });
    expect(widgetLayout({ width: 0, height: 0 })).toMatchObject({ compact: true });
  });

  it('drops to one line per item when the widget is short, e.g. an older 3×2 placement', () => {
    const small = widgetLayout({ width: 180, height: 110 });
    expect(small).toMatchObject({ compact: true, fr: 14, padding: 10 });
    expect(small.button).toBeLessThanOrEqual(26);
  });

  it('grows the text with the widget, limited by the tighter side', () => {
    const big = widgetLayout({ width: 400, height: 400 });
    expect(big.fr).toBeGreaterThan(widgetLayout(WIDGET_BASE_SIZE).fr);
    // Wide but short: height decides, so nothing overflows.
    expect(widgetLayout({ width: 600, height: WIDGET_BASE_SIZE.height }).fr).toBe(16);
  });

  it('gives the sentence and translations more lines when tall, up to a readable maximum', () => {
    expect(widgetLayout({ width: 260, height: 300 })).toMatchObject({ frLines: 2, subLines: 2 });
    expect(widgetLayout({ width: 2000, height: 2000 })).toMatchObject({ fr: 26, button: 48 });
  });
});
