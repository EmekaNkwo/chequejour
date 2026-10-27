/**
 * expo-notifications implementation of NotificationsApi. Local notifications only:
 * the app never requests a push token and has no server.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannedNotification } from '../../domain/notification-plan';
import type { NotificationsApi } from './sync';

export const DAILY_CHANNEL_ID = 'daily';
export const REMINDER_CHANNEL_ID = 'reminders';

let channelReady = false;

/** Two channels so learners can silence reminders in Android settings but keep the daily items. */
export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(DAILY_CHANNEL_ID, {
    name: 'Chaque Jour: word and sentence of the day',
    description: 'Your daily French word and sentence',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Chaque Jour: practice reminders',
    description: 'A nudge when you have missed a day of French',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/** Shows notifications as a banner while the app is open, without sound or badges. */
export function installForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function notificationPermission(): Promise<PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/** On Android 13+ the system prompt only appears once a channel exists. */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  if (!current.canAskAgain) return 'denied';
  const { status } = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false } });
  return status === 'granted' ? 'granted' : 'denied';
}

export async function exactAlarmsAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const { granted } = await Notifications.getExactAlarmPermissionsAsync();
  return granted;
}

/** Opens Android's "Alarms & reminders" setting. */
export async function requestExactAlarms(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const { granted } = await Notifications.requestExactAlarmPermissionsAsync();
  return granted;
}

export const expoNotificationsApi: NotificationsApi = {
  async canNotify() {
    return (await notificationPermission()) === 'granted';
  },
  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
  async schedule(n: PlannedNotification) {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { url: n.url } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: n.fireAt,
        channelId: n.kind === 'reminder' ? REMINDER_CHANNEL_ID : DAILY_CHANNEL_ID,
      },
    });
  },
};
