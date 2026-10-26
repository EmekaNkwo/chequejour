import { fireEvent, render, screen } from '@testing-library/react-native';
import type { OfflineFrench } from '../../features/speech/useOfflineFrench';
import { OfflineCheck } from '../speaking/OfflineCheck';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../ui/PressableScale', () => ({ PressableScale: jest.requireActual('react-native').Pressable }));
jest.mock('../ui/Toast', () => ({ useToast: () => ({ show: jest.fn(), confirm: jest.fn() }) }));
jest.mock('../ui/Progress', () => ({ ProgressRing: () => null, ProgressBar: () => null, BarChart: () => null }));

let mockSpeech: OfflineFrench;
jest.mock('../../features/speech/useOfflineFrench', () => ({ useOfflineFrench: () => mockSpeech }));

const base: OfflineFrench = { status: null, listening: false, heard: null, error: null, listen: jest.fn(async () => 'started' as const), stop: jest.fn(), reset: jest.fn() };
const show = () =>
  render(
    <ThemeProvider preference="light">
        <OfflineCheck line="Le samedi, nous nous levons vers dix heures." disabled={false} />
    </ThemeProvider>,
  );

describe('OfflineCheck', () => {
  it('stays hidden on phones that cannot guarantee on-device recognition', async () => {
    mockSpeech = { ...base, status: { status: 'unsupported' } };
    await show();
    expect(screen.queryByTestId('offline-check')).toBeNull();
    expect(screen.queryByTestId('offline-check-setup')).toBeNull();
  });

  it('explains how to install the French pack when it is missing', async () => {
    mockSpeech = { ...base, status: { status: 'needs-pack' } };
    await show();
    expect(screen.getByText(/never uses online recognition/)).toBeTruthy();
    await fireEvent.press(screen.getByText('How to install French'));
    expect(screen.getByText(/Add French \(France or Canada\)/)).toBeTruthy();
    expect(screen.queryByTestId('offline-check-listen')).toBeNull();
  });

  it('listens on demand and shows how much of the line was heard', async () => {
    mockSpeech = { ...base, status: { status: 'ready', locale: 'fr-FR' } };
    const { rerender } = await show();
    await fireEvent.press(screen.getByTestId('offline-check-listen'));
    expect(mockSpeech.listen).toHaveBeenCalled();
    mockSpeech = { ...mockSpeech, heard: 'le samedi nous nous levons vers dix heures' };
    await rerender(
      <ThemeProvider preference="light">
            <OfflineCheck line="Le samedi, nous nous levons vers dix heures." disabled={false} />
        </ThemeProvider>,
    );
    expect(screen.getByText('Your phone heard 8 of 8 words')).toBeTruthy();
    expect(screen.getByText(/not a pronunciation score/)).toBeTruthy();
  });
});
