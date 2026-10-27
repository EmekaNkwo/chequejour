import { act, renderHook } from '@testing-library/react-native';
import { useBackupExport } from '../settings/useBackupExport';

const mockSaveToFolder = jest.fn();
const mockExportToFile = jest.fn();
jest.mock('../settings/backup-files', () => ({ saveToFolder: (...a: unknown[]) => mockSaveToFolder(...a), exportToFile: (...a: unknown[]) => mockExportToFile(...a) }));
const mockUpdateSetting = jest.fn(async () => undefined);
jest.mock('../app/AppContext', () => ({ useApp: () => ({ db: {}, updateSetting: mockUpdateSetting }) }));
const mockShow = jest.fn();
const mockConfirm = jest.fn();
jest.mock('../../components/ui/Toast', () => ({ useToast: () => ({ show: mockShow, confirm: mockConfirm }) }));

beforeEach(() => jest.clearAllMocks());

async function run(action: 'exportNow' | 'shareNow') {
  const { result } = await renderHook(() => useBackupExport());
  await act(async () => {
    await result.current[action]();
  });
}

describe('backing up', () => {
  it('records the backup once the file is written to the chosen folder', async () => {
    mockSaveToFolder.mockResolvedValue({ ok: true, uri: 'content://x/b.json' });
    await run('exportNow');
    expect(mockUpdateSetting).toHaveBeenCalledWith('lastBackupDay', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));
  });

  it('records nothing when the folder picker is cancelled', async () => {
    mockSaveToFolder.mockResolvedValue(null);
    await run('exportNow');
    expect(mockUpdateSetting).not.toHaveBeenCalled();
  });

  it('records nothing and says so when writing fails', async () => {
    mockSaveToFolder.mockRejectedValue(new Error('disk full'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await run('exportNow');
    expect(mockUpdateSetting).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }));
  });

  it('after sharing, records the backup only if the learner says it was saved', async () => {
    mockExportToFile.mockResolvedValue({ ok: true, uri: 'file:///cache/b.json', shared: true });
    mockConfirm.mockResolvedValue(false);
    await run('shareNow');
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockUpdateSetting).not.toHaveBeenCalled();
    mockConfirm.mockResolvedValue(true);
    await run('shareNow');
    expect(mockUpdateSetting).toHaveBeenCalledTimes(1);
  });

  it('says which kind of backup is running', async () => {
    let finish: (v: null) => void = () => undefined;
    mockSaveToFolder.mockReturnValue(new Promise((r) => (finish = r)));
    const { result } = await renderHook(() => useBackupExport());
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.exportNow();
    });
    expect(result.current).toMatchObject({ exporting: true, running: 'folder' });
    await act(async () => {
      finish(null);
      await pending;
    });
    expect(result.current).toMatchObject({ exporting: false, running: null });
  });

  it('reports a share that could not be prepared', async () => {
    mockExportToFile.mockResolvedValue({ ok: false, error: 'nope' });
    await run('shareNow');
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error', message: 'nope' }));
    expect(mockUpdateSetting).not.toHaveBeenCalled();
  });
});
