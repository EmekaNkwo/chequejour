import { addWidgetOutcome, isXiaomi, type PinDeps } from '../widget/widget-pin';

function deps(counts: number[], accepted: boolean, away: 'stayed' | 'returned'): PinDeps {
  let call = 0;
  return {
    request: jest.fn(async () => accepted),
    count: jest.fn(async () => counts[Math.min(call++, counts.length - 1)]!),
    waitForPrompt: jest.fn(async () => away),
  };
}

describe('adding the widget from the app', () => {
  it('says the launcher cannot pin when the request is refused', async () => {
    const d = deps([0], false, 'stayed');
    expect(await addWidgetOutcome(d)).toBe('unsupported');
    expect(d.waitForPrompt).not.toHaveBeenCalled();
  });

  it('reports a widget that was added through the launcher prompt', async () => {
    expect(await addWidgetOutcome(deps([1, 2], true, 'returned'))).toBe('added');
  });

  it('spots a launcher that accepts the request but never shows a prompt (MIUI)', async () => {
    expect(await addWidgetOutcome(deps([0, 0], true, 'stayed'))).toBe('no-prompt');
  });

  it('stays quiet when the learner dismissed the prompt', async () => {
    expect(await addWidgetOutcome(deps([0, 0], true, 'returned'))).toBe('dismissed');
  });

  it('treats a widget count it cannot read as zero', async () => {
    const d = deps([0], true, 'returned');
    d.count = jest.fn(async () => Promise.reject(new Error('no provider')));
    expect(await addWidgetOutcome(d)).toBe('dismissed');
  });

  it('recognises Xiaomi, Redmi and POCO phones', () => {
    expect(isXiaomi({ Manufacturer: 'Xiaomi', Brand: 'POCO' })).toBe(true);
    expect(isXiaomi({ Manufacturer: 'xiaomi', Brand: 'Redmi' })).toBe(true);
    expect(isXiaomi({ Manufacturer: 'Google', Brand: 'google' })).toBe(false);
    expect(isXiaomi(undefined)).toBe(false);
  });
});
