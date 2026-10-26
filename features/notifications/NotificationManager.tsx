/**
 * Opens the right screen when a notification is tapped (cold start or running) and
 * keeps the schedule in sync on launch, on returning to the foreground (covers
 * reboots and time-zone changes) and whenever notification settings change.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { currentUnitId, PLACEMENT_START_UNIT, unitStatuses } from '../../domain/unit-path';
import { useApp } from '../app/AppContext';
import { logError } from '../app/log';
import { expoNotificationsApi, installForegroundHandler } from './expo-notifications-api';
import { syncNotifications } from './sync';

installForegroundHandler();

function openFromNotification(response: Notifications.NotificationResponse | null | undefined): void {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && (url.startsWith('/daily/') || url === '/session')) {
    router.push(url as never);
    Notifications.clearLastNotificationResponseAsync().catch((e: unknown) => logError('clear notification', e));
  }
}

export function NotificationManager() {
  const { content, progress, settings, today, dataVersion } = useApp();
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    openFromNotification(last);
  }, [last]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);

  const notificationSettings = settings.notifications;
  const placement = settings.placementLevel;
  const onboarded = settings.onboarded;
  const { reminder: reminderToggle, examDate, dailyGoal, installDay } = settings;
  // Studying moves the missed-day reminders, so resync when the last study day changes.
  const [lastActive, setLastActive] = useState<string | null>(null);
  useEffect(() => {
    progress
      .lastActiveDay()
      .then(setLastActive)
      .catch((e: unknown) => logError('last active day', e));
  }, [progress, dataVersion]);

  useEffect(() => {
    if (!onboarded) return;
    const run = async () => {
      const [units, unitProgress] = await Promise.all([content.units(), progress.unitProgress()]);
      const placementStart = PLACEMENT_START_UNIT[placement ?? 'A2'];
      const statuses = unitStatuses(units, unitProgress, placementStart);
      const openUnitIds = units.filter((u) => statuses.get(u.id) !== 'locked').map((u) => u.id);
      const currentId = currentUnitId(units, statuses, placementStart);
      const level = units.find((u) => u.id === currentId)?.level ?? 'A2';
      await syncNotifications(expoNotificationsApi, {
        content,
        progress,
        settings: notificationSettings,
        reminder: { toggle: reminderToggle, examDate, dailyGoal, installDay },
        today,
        learner: { openUnitIds, level },
        now: new Date(),
      });
    };
    run().catch((e: unknown) => logError('notification sync', e));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run().catch((e: unknown) => logError('notification sync', e));
    });
    return () => sub.remove();
  }, [content, progress, notificationSettings, placement, onboarded, today, reminderToggle, examDate, dailyGoal, installDay, lastActive]);

  return null;
}
