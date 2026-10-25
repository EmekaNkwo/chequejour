import { dueCards, gradeFromResult, isDue, isMastered, newCard, reviewCard } from '../srs';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1, 9);

describe('srs scheduler', () => {
  it('creates a new card due immediately', () => {
    const card = newCard('u01-w001', 'word', T0);
    expect(card.state).toBe('new');
    expect(card.reps).toBe(0);
    expect(isDue(card, T0)).toBe(true);
  });

  it('does not mutate the input card', () => {
    const card = newCard('u01-w001', 'word', T0);
    const snapshot = { ...card };
    reviewCard(card, 'good', T0);
    expect(card).toEqual(snapshot);
  });

  it('pushes the due date further with each good review', () => {
    let card = newCard('x', 'word', T0);
    let now = T0;
    const intervals: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      card = reviewCard(card, 'good', now);
      intervals.push(card.due - now);
      now = card.due;
    }
    expect(card.state).toBe('review');
    expect(intervals[5]).toBeGreaterThan(intervals[2]);
    expect(card.reps).toBe(6);
  });

  it('easy schedules later than hard, and again resets to a short interval', () => {
    const base = reviewCard(reviewCard(newCard('x', 'word', T0), 'good', T0), 'good', T0 + DAY);
    const now = base.due;
    const hard = reviewCard(base, 'hard', now);
    const easy = reviewCard(base, 'easy', now);
    const again = reviewCard(base, 'again', now);
    expect(easy.due).toBeGreaterThan(hard.due);
    expect(again.due - now).toBeLessThan(DAY);
    expect(again.lapses).toBe(base.lapses + 1);
  });

  it('marks a card mastered after enough successful spaced reviews', () => {
    let card = newCard('x', 'word', T0);
    let now = T0;
    for (let i = 0; i < 8 && !isMastered(card); i += 1) {
      card = reviewCard(card, 'good', now);
      now = card.due;
    }
    expect(isMastered(card)).toBe(true);
  });

  it('lists due cards most overdue first', () => {
    const a = { ...newCard('a', 'word', T0), due: T0 - DAY };
    const b = { ...newCard('b', 'word', T0), due: T0 - 3 * DAY };
    const c = { ...newCard('c', 'word', T0), due: T0 + DAY };
    expect(dueCards([a, b, c], T0).map((x) => x.itemId)).toEqual(['b', 'a']);
  });

  it('maps exercise results to grades', () => {
    expect(gradeFromResult('correct')).toBe('good');
    expect(gradeFromResult('almost')).toBe('hard');
    expect(gradeFromResult('wrong')).toBe('again');
  });
});
