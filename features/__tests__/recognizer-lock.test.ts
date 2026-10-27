import { acquireRecognizer } from '../../services/ai/recognizer-lock';

describe('the phone’s single speech recognizer', () => {
  it('hands the recognizer out one user at a time, in order', async () => {
    const order: string[] = [];
    const first = await acquireRecognizer();
    const second = acquireRecognizer().then((release) => {
      order.push('second');
      return release;
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual([]);
    first();
    (await second)();
    expect(order).toEqual(['second']);
    (await acquireRecognizer())();
  });
});
