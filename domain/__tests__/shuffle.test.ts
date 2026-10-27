import { seededShuffle, shuffledOrder } from '../shuffle';

describe('seeded shuffle', () => {
  it('is deterministic and keeps all items', () => {
    const a = seededShuffle([1, 2, 3, 4, 5, 6], 'u01-ex01');
    expect(seededShuffle([1, 2, 3, 4, 5, 6], 'u01-ex01')).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('never returns the original order', () => {
    for (let i = 0; i < 200; i += 1) {
      const order = shuffledOrder(3, `seed-${i}`);
      expect(order).not.toEqual([0, 1, 2]);
      expect([...order].sort()).toEqual([0, 1, 2]);
    }
    expect(shuffledOrder(1, 'x')).toEqual([0]);
  });
});
