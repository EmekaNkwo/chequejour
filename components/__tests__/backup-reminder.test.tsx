import { fireEvent, render, screen } from '@testing-library/react-native';
import { DEFAULT_SETTINGS, type Settings } from '../../data/settings-repo';
import { BackupReminderCard, BackupStatus } from '../settings/BackupReminder';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('../ui/Progress', () => ({ ProgressRing: () => null, ProgressBar: () => null, BarChart: () => null }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../ui/PressableScale', () => ({ PressableScale: jest.requireActual('react-native').Pressable }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockExportNow = jest.fn(async () => undefined);
jest.mock('../../features/settings/useBackupExport', () => ({ useBackupExport: () => ({ exporting: false, exportNow: mockExportNow }) }));
let mockApp: { settings: Settings; today: string };
jest.mock('../../features/app/AppContext', () => ({ useApp: () => mockApp }));

const withSettings = (s: Partial<Settings>, today = '2026-10-26') => {
  mockApp = { settings: { ...DEFAULT_SETTINGS, installDay: '2026-09-01', ...s }, today };
};
const show = (ui: React.ReactElement) => render(<ThemeProvider preference="light">{ui}</ThemeProvider>);

describe('backup reminder card', () => {
  it('stays hidden until a backup is due', async () => {
    withSettings({ lastBackupDay: '2026-10-20' });
    await show(<BackupReminderCard />);
    expect(screen.queryByTestId('backup-reminder')).toBeNull();
  });

  it('shows when due, backs up on tap and can be put off until tomorrow', async () => {
    withSettings({ lastBackupDay: '2026-10-01' });
    await show(<BackupReminderCard />);
    expect(screen.getByText(/last backup was 25 days ago/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('backup-now'));
    expect(mockExportNow).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('backup-later'));
    expect(screen.queryByTestId('backup-reminder')).toBeNull();
  });

  it('never shows when reminders are off', async () => {
    withSettings({ lastBackupDay: null, backupReminder: { intervalDays: null, notify: false } }, '2026-10-27');
    await show(<BackupReminderCard />);
    expect(screen.queryByTestId('backup-reminder')).toBeNull();
  });
});

describe('backup status', () => {
  it('shows how long ago the last backup was', async () => {
    withSettings({ lastBackupDay: '2026-10-12' });
    await show(<BackupStatus />);
    expect(screen.getByText('Last backup: 14 days ago')).toBeTruthy();
  });
});
