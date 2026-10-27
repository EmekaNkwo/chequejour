import { GRADES, soundCorrection } from '../ai/corrections';

const text = "Salut Marc, je t'invite a mon anniversaire. Je suis rentre tres tard mais je etais content. Les enfants sont venu.";

describe('grade detection', () => {
  it('catches the usual ways of grading', () => {
    for (const t of ['8 out of 10', 'You scored well', '7 points for content', 'This is B2', 'intermediate level work', 'mark of 12', '15 sur 20']) {
      expect(GRADES.test(t)).toBe(true);
    }
  });

  it('does not mistake ordinary advice for a grade', () => {
    for (const t of ['Please note: use "à" before cities.', 'Add a second argument.', 'Note the agreement of the past participle.']) {
      expect(GRADES.test(t)).toBe(false);
    }
  });
});

describe('a single AI correction', () => {
  it('keeps accent, agreement and elision fixes of words the learner wrote', () => {
    expect(soundCorrection({ original: 'rentre', corrected: 'rentré', why: 'The past participle ends in -é.' }, text)).toEqual({ original: 'rentre', corrected: 'rentré', why: 'The past participle ends in -é.' });
    expect(soundCorrection({ original: 'sont venu', corrected: 'sont venus', why: 'Agreement.' }, text)).not.toBeNull();
    expect(soundCorrection({ original: 'je etais', corrected: "j'étais", why: 'Elision.' }, text)).not.toBeNull();
  });

  it('drops words the learner never wrote, changes of nothing, rewrites and unsafe fixes', () => {
    expect(soundCorrection({ original: 'je suis allée', corrected: 'je suis allé', why: 'x' }, text)).toBeNull();
    expect(soundCorrection({ original: 'Salut Marc', corrected: 'salut Marc', why: 'x' }, text)).toBeNull();
    expect(soundCorrection({ original: 'rentre', corrected: 'retourné', why: 'x' }, text)).toBeNull();
    expect(soundCorrection({ original: 'content', corrected: 'Va sur www.exemple.fr', why: 'x' }, text)).toBeNull();
  });

  it('keeps a sound fix whose reason is not in English, without the reason', () => {
    const out = soundCorrection({ original: 'a mon', corrected: 'à mon', why: 'La préposition « à » prend un accent ; « a » est le verbe avoir.' }, text);
    expect(out).toEqual({ original: 'a mon', corrected: 'à mon', why: null });
  });
});
