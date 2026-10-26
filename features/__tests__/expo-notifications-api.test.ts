import type * as Api from '../notifications/expo-notifications-api';
import type { PlannedNotification } from '../../domain/notification-plan';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExactAlarmPermissionsAsync: jest.fn(),
  requestExactAlarmPermissionsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
}));

type NotificationsMock = Record<string, jest.Mock>;

let N: NotificationsMock;
let api: typeof Api;

function load(os: 'ios' | 'android') {
  jest.resetModules();
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  N = jest.requireMock('expo-notifications');
  Object.values(N).forEach((v) => typeof v === 'function' && 'mockClear' in v && v.mockClear());
  api = require('../notifications/expo-notifications-api');
}

const planned = (kind: PlannedNotification['kind']): PlannedNotification =>
  ({ id: `${kind}-1`, kind, title: 'T', body: 'B', url: '/daily', fireAt: new Date(2026, 9, 27, 8) }) as PlannedNotification;

describe('expo notifications api on Android', () => {
  beforeEach(() => load('android'));

  it('creates the daily and reminder channels once', async () => {
    await api.ensureChannel();
    await api.ensureChannel();
    expect(N.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(api.DAILY_CHANNEL_ID, expect.objectContaining({ importance: 3 }));
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(api.REMINDER_CHANNEL_ID, expect.objectContaining({ importance: 3 }));
  });

  it('schedules daily items and reminders on their own channels', async () => {
    await api.expoNotificationsApi.schedule(planned('word'));
    await api.expoNotificationsApi.schedule(planned('reminder'));
    expect(N.scheduleNotificationAsync).toHaveBeenNthCalledWith(1, {
      identifier: 'word-1',
      content: { title: 'T', body: 'B', data: { url: '/daily' } },
      trigger: { type: 'date', date: planned('word').fireAt, channelId: 'daily' },
    });
    expect(N.scheduleNotificationAsync.mock.calls[1][0].trigger.channelId).toBe('reminders');
  });

  it('reads and requests the exact alarm permission', async () => {
    N.getExactAlarmPermissionsAsync.mockResolvedValue({ granted: false });
    N.requestExactAlarmPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await api.exactAlarmsAllowed()).toBe(false);
    expect(await api.requestExactAlarms()).toBe(true);
  });

  it('creates the channels before asking for permission', async () => {
    N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    N.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    expect(await api.requestNotificationPermission()).toBe('granted');
    expect(N.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(N.requestPermissionsAsync.mock.invocationCallOrder[0]);
  });
});

describe('expo notifications api on iOS', () => {
  beforeEach(() => load('ios'));

  it('needs no channels or exact alarm permission', async () => {
    await api.ensureChannel();
    expect(N.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(await api.exactAlarmsAllowed()).toBe(true);
    expect(await api.requestExactAlarms()).toBe(true);
    expect(N.getExactAlarmPermissionsAsync).not.toHaveBeenCalled();
  });

  it('maps the permission status', async () => {
    for (const [status, expected] of [['granted', 'granted'], ['denied', 'denied'], ['undetermined', 'undetermined']] as const) {
      N.getPermissionsAsync.mockResolvedValueOnce({ status });
      expect(await api.notificationPermission()).toBe(expected);
    }
    N.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    expect(await api.expoNotificationsApi.canNotify()).toBe(true);
    N.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    expect(await api.expoNotificationsApi.canNotify()).toBe(false);
  });

  it('asks only when it can, for alerts without badges or sound', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    expect(await api.requestNotificationPermission()).toBe('granted');
    N.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied', canAskAgain: false });
    expect(await api.requestNotificationPermission()).toBe('denied');
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    N.getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined', canAskAgain: true });
    N.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    expect(await api.requestNotificationPermission()).toBe('denied');
    expect(N.requestPermissionsAsync).toHaveBeenCalledWith({ ios: { allowAlert: true, allowBadge: false, allowSound: false } });
  });

  it('shows foreground notifications as a silent banner', async () => {
    api.installForegroundHandler();
    const handler = N.setNotificationHandler.mock.calls[0][0];
    expect(await handler.handleNotification()).toEqual({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false });
  });

  it('cancels everything scheduled', async () => {
    await api.expoNotificationsApi.cancelAll();
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });
});
