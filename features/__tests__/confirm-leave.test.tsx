import { act, renderHook } from '@testing-library/react-native';
import { useConfirmLeave } from '../app/useConfirmLeave';

type Blocked = (e: { data: { action: unknown }; repeat: () => void }) => void;
const calls: { prevent: boolean; onBlocked?: Blocked }[] = [];
jest.mock('expo-router', () => ({
  usePreventRemove: (prevent: boolean, onBlocked?: Blocked) => {
    calls.push({ prevent, onBlocked });
    return () => undefined;
  },
}));

const last = () => calls[calls.length - 1]!;

beforeEach(() => {
  calls.length = 0;
});

describe('confirm before leaving', () => {
  it('only guards while work is in progress', async () => {
    const { rerender } = await renderHook(({ active }: { active: boolean }) => useConfirmLeave(active, async () => true), { initialProps: { active: false } });
    expect(last().prevent).toBe(false);
    await rerender({ active: true });
    expect(last().prevent).toBe(true);
  });

  it('stays on the screen when the learner keeps going', async () => {
    const repeat = jest.fn();
    await renderHook(() => useConfirmLeave(true, async () => false));
    await act(async () => last().onBlocked!({ data: { action: {} }, repeat }));
    expect(repeat).not.toHaveBeenCalled();
    expect(last().prevent).toBe(true);
  });

  it('leaves, and stops guarding, once the learner confirms', async () => {
    const repeat = jest.fn();
    const confirm = jest.fn(async () => true);
    await renderHook(() => useConfirmLeave(true, confirm));
    await act(async () => last().onBlocked!({ data: { action: {} }, repeat }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(repeat).toHaveBeenCalledTimes(1);
    expect(last().prevent).toBe(false);
  });
});
