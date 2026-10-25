import { answerToast, toastDuration } from '../toast';

describe('toastDuration', () => {
  it('keeps short confirmations brief and errors longer', () => {
    expect(toastDuration({ tone: 'success', title: 'Saved' })).toBe(2500);
    expect(toastDuration({ tone: 'info', title: 'Note' })).toBe(3500);
    expect(toastDuration({ tone: 'error', title: 'Failed' })).toBe(5000);
  });

  it('gives long messages more reading time, up to a limit', () => {
    const long = 'word '.repeat(60);
    expect(toastDuration({ tone: 'info', title: 'Note', message: long })).toBeGreaterThan(3500);
    expect(toastDuration({ tone: 'info', title: 'Note', message: long.repeat(10) })).toBe(10000);
  });

  it('stays until dismissed when it asks for a decision or sets its own time', () => {
    expect(toastDuration({ tone: 'warning', title: 'Delete?', actions: [{ label: 'Delete' }] })).toBeNull();
    expect(toastDuration({ tone: 'error', title: 'Wrong', duration: null })).toBeNull();
    expect(toastDuration({ tone: 'success', title: 'Ok', duration: 1000 })).toBe(1000);
  });
});

describe('answerToast', () => {
  it('celebrates a correct answer and keeps the explanation', () => {
    expect(answerToast({ result: 'correct', expected: 'le' }, 'Masculine object.')).toEqual({
      tone: 'success',
      title: 'Correct',
      message: 'Masculine object.',
      detail: undefined,
      duration: 3000,
    });
  });

  it('shows the right answer after a wrong answer, with time to read it', () => {
    const toast = answerToast({ result: 'wrong', expected: 'le' }, 'Masculine object.');
    expect(toast).toEqual({ tone: 'error', title: 'Not quite', message: 'Masculine object.', detail: 'le' });
    expect(toastDuration(toast)).toBe(5000);
  });

  it('mentions the accent note on an almost-right answer', () => {
    const toast = answerToast({ result: 'almost', expected: 'été', note: 'Watch the accents.' }, 'Past participle.');
    expect(toast).toMatchObject({ tone: 'warning', title: 'Almost', detail: 'été', message: 'Watch the accents.\nPast participle.' });
  });
});
