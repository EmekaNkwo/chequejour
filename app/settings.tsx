import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SpeedSelector } from '../components/audio/AudioControls';
import { ExamDateRow, TargetNclcRow } from '../components/settings/ExamSettings';
import { SettingsGroup, SwitchRow, TimePickerRow } from '../components/settings/SettingRows';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { SegmentedTabs } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { AUDIO_CLIPS } from '../content/build/audio-manifest';
import { resetProgress } from '../data/backup';
import type { Settings, ThemePreference } from '../data/settings-repo';
import { lastBackupLabel, type BackupInterval } from '../domain/backup-reminder';
import type { NotificationToggle } from '../domain/notification-plan';
import type { DailyGoal } from '../domain/session';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';
import { deleteAllRecordingFiles, deleteAllRecordings } from '../features/skills/recordings';
import { useLoad } from '../features/app/useLoad';
import { hasFrenchVoice } from '../features/audio/audio-controller';
import { exactAlarmsAllowed, notificationPermission, requestExactAlarms, requestNotificationPermission } from '../features/notifications/expo-notifications-api';
import { importFromFile } from '../features/settings/backup-files';
import { useBackupExport } from '../features/settings/useBackupExport';
import { requestPinWidget } from 'react-native-android-widget';
import { WORD_WIDGET_NAME } from '../widget/WordOfDayWidget';
import { WidgetPreviewCard } from '../components/settings/WidgetPreviewCard';

const GOALS: readonly { value: `${DailyGoal}`; label: string }[] = [
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '20', label: '20 min' },
];


const BACKUP_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: 'off', label: 'Off' },
];

const THEMES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const PERMISSION_TEXT = {
  granted: 'Notifications are allowed.',
  denied: 'Notifications are blocked. Allow them in your phone settings to get the word and sentence of the day.',
  undetermined: 'Notifications are not allowed yet.',
} as const;

const clipCount = Object.keys(AUDIO_CLIPS).length;

export default function SettingsScreen() {
  const app = useApp();
  const { settings, updateSetting } = app;
  const [busy, setBusy] = useState<'import' | 'reset' | 'recordings' | null>(null);
  const { exporting, running, exportNow, shareNow } = useBackupExport();
  const toast = useToast();
  const { data, error, reload } = useLoad(
    'settings',
    async () => {
      // Each probe falls back on failure so one broken API can't block backup and reset.
      const probe = <T,>(label: string, p: Promise<T>, fallback: T): Promise<T> =>
        p.catch((e: unknown) => {
          logError(label, e);
          return fallback;
        });
      const [permission, exact, frenchVoice, contentVersion] = await Promise.all([
        probe('notification permission', notificationPermission(), 'undetermined' as const),
        probe('exact alarms', exactAlarmsAllowed(), false),
        probe('french voice', hasFrenchVoice(), false),
        probe('content version', app.progress.meta('content_version'), null),
      ]);
      return { permission, exact, frenchVoice, contentVersion };
    },
    [],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const save = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    updateSetting(key, value).catch((e: unknown) => {
      logError(`save setting ${key}`, e);
      toast.show({ tone: 'error', title: 'Setting not saved', message: 'Please try again.' });
    });
  };

  const setToggle = (kind: 'word' | 'sentence', next: Partial<NotificationToggle>) =>
    save('notifications', { ...settings.notifications, [kind]: { ...settings.notifications[kind], ...next } });

  const askPermission = async () => {
    try {
      await requestNotificationPermission();
    } catch (e: unknown) {
      logError('notification permission', e);
    }
    reload();
  };

  const askExact = async () => {
    try {
      await requestExactAlarms();
    } catch (e: unknown) {
      logError('exact alarms', e);
    }
    reload();
  };

  const doImport = async () => {
    const ok = await toast.confirm({
      title: 'Replace your progress?',
      message: 'Importing a backup replaces the progress on this phone with the one in the file.',
      confirmLabel: 'Choose file',
    });
    if (!ok) return;
    setBusy('import');
    try {
      const result = await importFromFile(app.db);
      if (result === null) return;
      if (!result.ok) {
        toast.show({ tone: 'error', title: 'Backup not restored', message: result.error });
        return;
      }
      await app.reloadSettings();
      toast.show({ tone: 'success', title: 'Progress restored', message: `${result.rows} records imported.` });
    } catch (e: unknown) {
      logError('import progress', e);
      toast.show({ tone: 'error', title: 'Backup not restored', message: "That file couldn't be read." });
    } finally {
      setBusy(null);
    }
  };

  const addWidget = async () => {
    try {
      const asked = await requestPinWidget({ widgetName: WORD_WIDGET_NAME });
      if (!asked) toast.show({ tone: 'info', title: 'Add it from your home screen', message: 'Long-press an empty spot, choose Widgets, then Chaque Jour › Mot du jour.' });
    } catch (e: unknown) {
      logError('pin widget', e);
      toast.show({ tone: 'info', title: 'Add it from your home screen', message: 'Long-press an empty spot, choose Widgets, then Chaque Jour › Mot du jour.' });
    }
  };

  const confirmDeleteRecordings = async () => {
    const ok = await toast.confirm({
      title: 'Delete all recordings?',
      message: 'This removes every speaking and shadowing recording from this phone. Your progress stays.',
      confirmLabel: 'Delete all',
      destructive: true,
    });
    if (!ok) return;
    setBusy('recordings');
    try {
      const count = await deleteAllRecordings(app.progress);
      toast.show({ tone: 'success', title: count === 0 ? 'No recordings to delete' : `${count} recording${count === 1 ? '' : 's'} deleted` });
    } catch (e: unknown) {
      logError('delete all recordings', e);
      toast.show({ tone: 'error', title: "Recordings couldn't be deleted", message: 'Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const confirmReset = async () => {
    const ok = await toast.confirm({
      title: 'Reset all progress?',
      message: 'This deletes your reviews, mistakes, streak, recordings and settings on this phone. Export a backup first if you might want them back.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (!ok) return;
    setBusy('reset');
    try {
      await resetProgress(app.db);
      try {
        deleteAllRecordingFiles();
      } catch (e: unknown) {
        logError('delete recordings', e);
      }
      await app.reloadSettings();
      toast.show({ tone: 'success', title: 'Progress reset', message: 'You can start again or restore a backup.' });
    } catch (e: unknown) {
      logError('reset progress', e);
      toast.show({ tone: 'error', title: "Progress couldn't be reset", message: 'Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const n = settings.notifications;
  const noAudio = clipCount === 0 && !data.frenchVoice;

  return (
    <Screen testID="settings-screen">
      <ScreenHeader title="Settings" back />

      <Card style={styles.card}>
        <SettingsGroup title="TCF Canada">
          <ExamDateRow value={settings.examDate} today={app.today} onChange={(v) => save('examDate', v)} />
          <TargetNclcRow value={settings.targetNclc} onChange={(v) => save('targetNclc', v)} />
        </SettingsGroup>
      </Card>

      <Card style={styles.card}>
        <SettingsGroup title="Notifications">
          <AppText variant="meta" tone={data.permission === 'granted' ? 'muted' : 'danger'}>
            {PERMISSION_TEXT[data.permission]}
          </AppText>
          {data.permission !== 'granted' ? <Button label="Allow notifications" variant="secondary" icon="bell" onPress={() => void askPermission()} /> : null}
          <SwitchRow label="Word of the Day" value={n.word.enabled} onChange={(v) => setToggle('word', { enabled: v })} testID="toggle-word" />
          <TimePickerRow label="Word time" value={n.word.time} onChange={(t) => setToggle('word', { time: t })} disabled={!n.word.enabled} testID="time-word" />
          <SwitchRow label="Sentence of the Day" value={n.sentence.enabled} onChange={(v) => setToggle('sentence', { enabled: v })} testID="toggle-sentence" />
          <TimePickerRow label="Sentence time" value={n.sentence.time} onChange={(t) => setToggle('sentence', { time: t })} disabled={!n.sentence.enabled} testID="time-sentence" />
          <SwitchRow
            label="Remind me when I miss a day"
            description="After 1, 2, 4, 7 and 12 days without practice, then weekly. Never on days you study."
            value={settings.reminder.enabled}
            onChange={(v) => save('reminder', { ...settings.reminder, enabled: v })}
            testID="toggle-reminder"
          />
          <TimePickerRow label="Reminder time" value={settings.reminder.time} onChange={(t) => save('reminder', { ...settings.reminder, time: t })} disabled={!settings.reminder.enabled} testID="time-reminder" />
          {Platform.OS === 'android' ? (
            data.exact ? (
              <AppText variant="meta" tone="muted">
                Exact alarms are allowed, so reminders arrive on time.
              </AppText>
            ) : (
              <View style={styles.gapSm}>
                <AppText variant="meta" tone="muted">
                  Android may deliver reminders a few minutes late. Allow &quot;Alarms &amp; reminders&quot; for exact times.
                </AppText>
                <Button label="Allow exact alarms" variant="secondary" icon="clock" onPress={() => void askExact()} />
              </View>
            )
          ) : null}
        </SettingsGroup>
      </Card>

      <Card style={styles.card}>
        <SettingsGroup title="Daily goal">
          <SegmentedTabs options={GOALS} value={`${settings.dailyGoal}`} onChange={(v) => save('dailyGoal', Number(v) as DailyGoal)} />
          <AppText variant="meta" tone="muted">
            Sets how many reviews go into each daily session. Changes apply from tomorrow&apos;s session.
          </AppText>
        </SettingsGroup>
      </Card>

      <Card style={styles.card}>
        <SettingsGroup title="Audio">
          <AppText variant="bodyStrong">Playback speed</AppText>
          <SpeedSelector value={settings.playbackRate} onChange={(rate) => save('playbackRate', rate)} />
          <SwitchRow label="Auto-play audio" description="Play words and sentences when a screen opens." value={settings.autoPlay} onChange={(v) => save('autoPlay', v)} />
          {noAudio ? (
            <AppText variant="meta" tone="danger">
              No French voice was found on this phone. Install one in your phone&apos;s text-to-speech settings to hear audio.
            </AppText>
          ) : clipCount === 0 ? (
            <AppText variant="meta" tone="muted">
              Audio uses your phone&apos;s French voice.
            </AppText>
          ) : null}
        </SettingsGroup>
      </Card>

      {Platform.OS === 'android' ? (
        <Card style={styles.card}>
          <SettingsGroup title="Home-screen widget">
            <AppText variant="meta" tone="muted">
              Shows the word of the day in French and English. Tap it to open the word. It follows your phone&apos;s light or dark mode.
            </AppText>
            <WidgetPreviewCard />
            <Button label="Add the widget" icon="grid" variant="secondary" onPress={() => void addWidget()} testID="add-widget" />
          </SettingsGroup>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <SettingsGroup title="Theme">
          <SegmentedTabs options={THEMES} value={settings.theme} onChange={(v) => save('theme', v)} />
        </SettingsGroup>
      </Card>

      <Card style={styles.card}>
        <SettingsGroup title="Your data">
          <AppText variant="meta" tone="muted">
            Progress lives only on this phone. Save a backup file (for example to Downloads or Google Drive) to keep it safe or move it to a new phone. Speaking recordings are not included.
          </AppText>
          <AppText variant="bodyStrong" testID="last-backup">
            {lastBackupLabel(settings.lastBackupDay, app.today)}
          </AppText>
          <Button label="Save backup to a folder" icon="folder" variant="secondary" onPress={() => void exportNow()} loading={running === 'folder'} disabled={busy !== null || exporting} testID="export-progress" />
          <Button label="Share backup" icon="share-2" variant="secondary" onPress={() => void shareNow()} loading={running === 'share'} disabled={busy !== null || exporting} testID="share-progress" />
          <Button label="Import progress" icon="download" variant="secondary" onPress={() => void doImport()} loading={busy === 'import'} disabled={busy !== null} testID="import-progress" />
          <AppText variant="label" tone="muted" style={styles.mtSm}>
            Backup reminder
          </AppText>
          <SegmentedTabs
            options={BACKUP_OPTIONS}
            value={settings.backupReminder.intervalDays === null ? 'off' : String(settings.backupReminder.intervalDays)}
            onChange={(v) => save('backupReminder', { ...settings.backupReminder, intervalDays: v === 'off' ? null : (Number(v) as BackupInterval) })}
          />
          {settings.backupReminder.intervalDays !== null ? (
            <SwitchRow
              label="Also send a notification"
              description="A reminder on your phone when a backup is due."
              value={settings.backupReminder.notify}
              onChange={(notify) => {
                save('backupReminder', { ...settings.backupReminder, notify });
                if (notify) void askPermission();
              }}
              testID="backup-notify"
            />
          ) : null}
          <Button
            label="Delete all recordings"
            icon="mic-off"
            variant="ghost"
            onPress={() => void confirmDeleteRecordings()}
            loading={busy === 'recordings'}
            disabled={busy !== null}
            testID="delete-recordings"
          />
          <Button label="Reset progress" icon="trash-2" variant="ghost" onPress={() => void confirmReset()} loading={busy === 'reset'} disabled={busy !== null} testID="reset-progress" />
        </SettingsGroup>
      </Card>

      <Card style={styles.card}>
        <SettingsGroup title="About">
          <AppText variant="body" tone="secondary">
            Chaque Jour works fully offline. There is no account, no server, no ads and no analytics: nothing you do leaves this phone unless you export it yourself.
          </AppText>
          <AppText variant="body" tone="secondary">
            Levels shown in the app are practice estimates. They are not official TCF results and don&apos;t predict your exam score.
          </AppText>
          <AppText variant="meta" tone="muted">
            {`Content version ${data.contentVersion ?? '—'} · ${clipCount} bundled audio clips`}
          </AppText>
        </SettingsGroup>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mtSm: { marginTop: spacing.sm },
  card: { gap: spacing.md },
  gapSm: { gap: spacing.sm },
});
