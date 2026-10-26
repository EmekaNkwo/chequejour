import { gapDisplayText, gapSpokenText } from '../exercises/gap-text';

const WJ = '⁠';

describe('gap in a sentence', () => {
  it('draws the gap as one unbreakable line', () => {
    expect(gapDisplayText('Je ___ français.')).toBe(`Je ＿${WJ}＿${WJ}＿ français.`);
  });

  it('keeps a gap after a hyphen on the same line as the verb', () => {
    expect(gapDisplayText('Cette pommade, mettez-___ deux fois par jour.')).toBe(`Cette pommade, mettez-${WJ}＿${WJ}＿${WJ}＿ deux fois par jour.`);
  });

  it('leaves ordinary hyphens alone and reads the gap as "blank"', () => {
    expect(gapDisplayText('Qu\'est-ce que tu ___ ?')).toBe(`Qu'est-ce que tu ＿${WJ}＿${WJ}＿ ?`);
    expect(gapSpokenText('mettez-___ deux fois')).toBe('mettez-blank deux fois');
  });
});
