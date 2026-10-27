/**
 * Small display pieces: pills, gender labels, skill thumbnails, list rows,
 * segmented tabs and section titles.
 */
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Gender, Level } from '../../domain/content-types';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing, type PaletteKey } from '../theme/tokens';
import { AppText } from './AppText';
import { ProgressBar } from './Progress';
import { PressableScale } from './PressableScale';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export const SKILL_ICON: Readonly<Record<PaletteKey, FeatherName>> = {
  listening: 'headphones',
  reading: 'book-open',
  structures: 'layers',
  writing: 'edit-3',
  speaking: 'mic',
  vocabulary: 'message-square',
  tests: 'award',
  unit: 'map',
};

export const SKILL_LABEL: Readonly<Record<PaletteKey, string>> = {
  listening: 'Listening',
  reading: 'Reading',
  structures: 'Language structures',
  writing: 'Writing',
  speaking: 'Speaking',
  vocabulary: 'Vocabulary',
  tests: 'Tests',
  unit: 'Unit',
};

export function Pill({ label, color, textColor, icon }: { label: string; color?: string; textColor?: string; icon?: FeatherName }) {
  const { colors } = useTheme();
  const fg = textColor ?? colors.text;
  return (
    <View style={[styles.pill, { backgroundColor: color ?? colors.surfaceRaised }]}>
      {icon ? <Feather name={icon} size={12} color={fg} /> : null}
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

export function LevelPill({ level }: { level: Level }) {
  const { colors } = useTheme();
  const palette =
    level === 'B1' ? colors.skills.tests : level === 'A2+' ? colors.skills.unit : level === 'A2' ? colors.skills.vocabulary : colors.skills.structures;
  return <Pill label={level} color={palette.tint} textColor={palette.onTint} />;
}

/** Gender always shown as text (masc. / fém.) as well as colour. */
export function GenderTag({ gender }: { gender: Gender | undefined }) {
  const { colors } = useTheme();
  if (!gender) return null;
  const label = gender === 'm' ? 'masc.' : gender === 'f' ? 'fém.' : 'masc. / fém.';
  const spoken = gender === 'm' ? 'masculine' : gender === 'f' ? 'feminine' : 'masculine or feminine';
  const fg = gender === 'f' ? colors.feminine : colors.masculine;
  const bg = gender === 'f' ? colors.feminineTint : colors.masculineTint;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} accessible accessibilityLabel={spoken}>
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

export function SkillThumb({ skill, size = 52, icon }: { skill: PaletteKey; size?: number; icon?: FeatherName }) {
  const { colors } = useTheme();
  const p = colors.skills[skill];
  return (
    <View style={[styles.thumb, { width: size, height: size, backgroundColor: p.tint }]} importantForAccessibility="no-hide-descendants">
      <Feather name={icon ?? SKILL_ICON[skill]} size={Math.round(size * 0.42)} color={p.onTint} />
    </View>
  );
}

export interface ListRowProps {
  skill: PaletteKey;
  category: string;
  title: string;
  right?: string;
  progress?: number;
  onPress: () => void;
  icon?: FeatherName;
  locked?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

/** Lesson row: tinted thumbnail, small category label, bold title, meta on the right, thin progress line. */
export function ListRow({ skill, category, title, right, progress, onPress, icon, locked, accessibilityLabel, testID }: ListRowProps) {
  const { colors, shadow } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={locked}
      accessibilityLabel={accessibilityLabel ?? `${category}. ${title}${right ? `. ${right}` : ''}${locked ? '. Locked' : ''}`}
      accessibilityState={{ disabled: !!locked }}
      style={[styles.row, shadow, { backgroundColor: colors.surface, opacity: locked ? 0.6 : 1 }]}
      testID={testID}
    >
      <SkillThumb skill={skill} icon={locked ? 'lock' : icon ?? 'play'} />
      <View style={styles.rowBody}>
        <AppText variant="label" tone="muted" numberOfLines={1}>
          {category.toUpperCase()}
        </AppText>
        <AppText variant="cardTitle" numberOfLines={2}>
          {title}
        </AppText>
        {progress !== undefined ? (
          <View style={styles.rowProgress}>
            <ProgressBar value={progress} height={4} color={colors.skills[skill].base} track={colors.skills[skill].tint} />
          </View>
        ) : null}
      </View>
      {right ? (
        <AppText variant="meta" tone="muted">
          {right}
        </AppText>
      ) : null}
    </PressableScale>
  );
}

export interface SegmentedTabsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedTabs<T extends string>({ options, value, onChange }: SegmentedTabsProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segments, { backgroundColor: colors.surface }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            style={[styles.segment, active && { backgroundColor: colors.text }]}
          >
            <AppText variant="meta" color={active ? colors.background : colors.textSecondary} numberOfLines={1}>
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </AppText>
      {action}
    </View>
  );
}

export function Row({ children, style, gap = spacing.md }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function LinkText({ label, onPress, icon }: { label: string; onPress: () => void; icon?: FeatherName }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="link" accessibilityLabel={label} style={styles.link}>
      <AppText variant="bodyStrong" tone="primary">
        {label}
      </AppText>
      {icon ? <Feather name={icon} size={16} color={colors.primary} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  thumb: { borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, minHeight: 76 },
  rowBody: { flex: 1, gap: 2 },
  rowProgress: { marginTop: spacing.sm },
  segments: { flexDirection: 'row', borderRadius: radii.pill, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  section: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
});
