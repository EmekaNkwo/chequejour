/**
 * Rows used on the settings screen: a labelled switch and a time picker.
 */
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { dateToTime, formatTime, timeToDate, type TimeOfDay } from '../../domain/dates';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { PressableScale } from '../ui/PressableScale';

export interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}

export function SwitchRow({ label, description, value, onChange, testID }: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="meta" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        accessibilityRole="switch"
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
        testID={testID}
      />
    </View>
  );
}

export interface TimePickerRowProps {
  label: string;
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
  disabled?: boolean;
  testID?: string;
}

/** Shows the time; tapping opens the system time picker (any minute). */
export function TimePickerRow({ label, value, onChange, disabled, testID }: TimePickerRowProps) {
  const { colors } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const time = formatTime(value);
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: timeToDate(value),
        mode: 'time',
        is24Hour: true,
        onValueChange: (_event, date) => onChange(dateToTime(date)),
      });
    } else {
      setIosOpen((o) => !o);
    }
  };
  return (
    <View style={[styles.group, disabled && styles.dim]}>
      <View style={styles.row}>
        <AppText variant="body" tone="secondary" style={styles.flex}>
          {label}
        </AppText>
        <PressableScale
          onPress={open}
          disabled={disabled}
          accessibilityLabel={`${label}, ${time}. Change time`}
          accessibilityState={{ disabled: !!disabled }}
          style={[styles.timeButton, { backgroundColor: colors.primaryTint }]}
          testID={testID}
        >
          <Feather name="clock" size={18} color={colors.primary} />
          <AppText variant="title" color={colors.primary}>
            {time}
          </AppText>
        </PressableScale>
      </View>
      {iosOpen && Platform.OS !== 'android' ? (
        <DateTimePicker
          value={timeToDate(value)}
          mode="time"
          display="spinner"
          onValueChange={(_event, date) => onChange(dateToTime(date))}
        />
      ) : null}
    </View>
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="label" tone="muted" accessibilityRole="header">
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 120 },
  timeButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: 999 },
  dim: { opacity: 0.5 },
  group: { gap: spacing.md },
});
