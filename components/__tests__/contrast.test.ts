import { contrastRatio, darkColors, lightColors, type ThemeColors } from '../theme/tokens';

const AA = 4.5;

function pairs(c: ThemeColors): [string, string, string][] {
  const list: [string, string, string][] = [
    ['text/background', c.text, c.background],
    ['text/surface', c.text, c.surface],
    ['secondary/surface', c.textSecondary, c.surface],
    ['muted/surface', c.textMuted, c.surface],
    ['muted/background', c.textMuted, c.background],
    ['onPrimary/primary', c.onPrimary, c.primary],
    ['primary/surface', c.primary, c.surface],
    ['success/successTint', c.success, c.successTint],
    ['danger/dangerTint', c.danger, c.dangerTint],
    ['masculine/tint', c.masculine, c.masculineTint],
    ['feminine/tint', c.feminine, c.feminineTint],
    ['tabInactive/tabBar', c.tabInactive, c.tabBar],
    ['text/unitGradient0', c.skills.unit.onBase, c.unitGradient[0]],
    ['text/unitGradient1', c.skills.unit.onBase, c.unitGradient[1]],
  ];
  for (const [k, p] of Object.entries(c.skills)) {
    list.push([`${k} onBase`, p.onBase, p.base], [`${k} onTint`, p.onTint, p.tint]);
  }
  return list;
}

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('%s theme contrast', (_, colors) => {
  it.each(pairs(colors))('%s passes WCAG AA', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });
});
