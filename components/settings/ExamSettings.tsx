/**
 * Exam date (optional) and target NCLC, shared by Settings and onboarding.
 */
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { addDays, fromDayKey, toDayKey, type DayKey } from '../../domain/dates';
import { NCLC_TARGETS, type Nclc } from '../../domain/tcf/nclc';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { LinkText, SegmentedTabs } from '../ui/Bits';
import { PressableScale } from '../ui/PressableScale';

const DEFAULT_LEAD_DAYS = 90;

export function formatExamDate(day: DayKey): string {
  return fromDayKey(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

export interface ExamDateRowProps {
  value: DayKey | null;
  today: DayKey;
  onChange: (value: DayKey | null) => void;
}

export function ExamDateRow({ value, today, onChange }: ExamDateRowProps) {
  const { colors } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const initial = fromDayKey(value ?? addDays(today, DEFAULT_LEAD_DAYS));
  const minimumDate = fromDayKey(today);
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: initial, mode: 'date', minimumDate, onValueChange: (_e, date) => onChange(toDayKey(date)) });
    } else setIosOpen((o) => !o);
  };
  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">TCF Canada exam date</AppText>
          <AppText variant="meta" tone="muted">
            Optional. Adds a countdown and focuses practice as the date nears.
          </AppText>
        </View>
        <PressableScale
          onPress={open}
          accessibilityLabel={value ? `Exam date ${formatExamDate(value)}. Change date` : 'Set your exam date'}
          style={[styles.button, { backgroundColor: colors.primaryTint }]}
          testID="exam-date"
        >
          <Feather name="calendar" size={18} color={colors.primary} />
          <AppText variant="bodyStrong" color={colors.primary}>
            {value ? formatExamDate(value) : 'Set date'}
          </AppText>
        </PressableScale>
      </View>
      {value ? <LinkText label="Remove the exam date" icon="x" onPress={() => onChange(null)} /> : null}
      {iosOpen && Platform.OS !== 'android' ? (
        <DateTimePicker value={initial} mode="date" display="inline" minimumDate={minimumDate} onValueChange={(_e, date) => onChange(toDayKey(date))} />
      ) : null}
    </View>
  );
}

const TARGET_OPTIONS = NCLC_TARGETS.map((n) => ({ value: String(n) as `${Nclc}`, label: `NCLC ${n}` }));

export function TargetNclcRow({ value, onChange }: { value: Nclc; onChange: (value: Nclc) => void }) {
  return (
    <View style={styles.group}>
      <View>
        <AppText variant="bodyStrong">Target level</AppText>
        <AppText variant="meta" tone="muted">
          The NCLC you aim for in each skill. Check the requirement for your program with IRCC.
        </AppText>
      </View>
      <SegmentedTabs options={TARGET_OPTIONS} value={String(value) as `${Nclc}`} onChange={(v) => onChange(Number(v) as Nclc)} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', minHeight: 48 },
  flex: { flex: 1, minWidth: 160 },
  button: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: 999 },
});
