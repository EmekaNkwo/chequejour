import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { backupDue, daysSinceBackup, lastBackupLabel } from '../../domain/backup-reminder';
import { useApp } from '../../features/app/AppContext';
import { useBackupExport } from '../../features/settings/useBackupExport';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row } from '../ui/Bits';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

/** "Not now" hides the card until the next day (or the next app start). */
let dismissedOn: string | null = null;

/** In-app nudge to export a backup, shown once the reminder interval has passed. */
export function BackupReminderCard() {
  const { settings, today } = useApp();
  const { colors } = useTheme();
  const { exporting, exportNow } = useBackupExport();
  const [dismissed, setDismissed] = useState(dismissedOn === today);
  const { backupReminder, lastBackupDay, installDay } = settings;
  if (dismissed || !backupDue(backupReminder, lastBackupDay, installDay, today)) return null;
  const days = daysSinceBackup(lastBackupDay, installDay, today);
  return (
    <Card testID="backup-reminder">
      <Row gap={spacing.sm}>
        <Feather name="shield" size={18} color={colors.primary} />
        <AppText variant="cardTitle" style={styles.flex}>
          Time for a backup
        </AppText>
      </Row>
      <AppText variant="body" tone="secondary">
        {lastBackupDay
          ? `Your last backup was ${days} days ago. Your progress lives only on this phone, so export a copy to keep it safe.`
          : 'Your progress lives only on this phone. Export a backup file to keep it safe if you lose or change phones.'}
      </AppText>
      <Row gap={spacing.sm} style={styles.mt}>
        <Button label="Back up now" icon="upload" onPress={() => void exportNow()} loading={exporting} style={styles.flex} testID="backup-now" />
        <Button
          label="Not now"
          variant="ghost"
          onPress={() => {
            dismissedOn = today;
            setDismissed(true);
          }}
          testID="backup-later"
        />
      </Row>
      <AppText variant="meta" tone="muted" onPress={() => router.push('/settings')}>
        Change how often in Settings.
      </AppText>
    </Card>
  );
}

/** "Last backup: N days ago", tappable to Settings. */
export function BackupStatus() {
  const { settings, today } = useApp();
  const { colors } = useTheme();
  const due = backupDue(settings.backupReminder, settings.lastBackupDay, settings.installDay, today);
  return (
    <Card onPress={() => router.push('/settings')} accessibilityLabel={`${lastBackupLabel(settings.lastBackupDay, today)}. Opens settings to back up.`} testID="backup-status">
      <Row gap={spacing.sm}>
        <Feather name={due ? 'alert-circle' : 'shield'} size={18} color={due ? colors.danger : colors.textMuted} />
        <AppText variant="bodyStrong" style={styles.flex}>
          {lastBackupLabel(settings.lastBackupDay, today)}
        </AppText>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
});
