import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../components/theme/ThemeProvider';
import { radii, spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LevelPill, Row, SectionTitle } from '../../components/ui/Bits';
import { Card } from '../../components/ui/Card';
import { BooksIllustration, BubblesIllustration, HeadphonesIllustration } from '../../components/ui/Illustrations';
import { ProgressBar } from '../../components/ui/Progress';
import { PressableScale } from '../../components/ui/PressableScale';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { loadPath, type UnitOnPath } from '../../features/path/path-service';
import { masteredIds } from '../../features/session/session-service';

export default function LearnScreen() {
  const { content, progress, settings } = useApp();
  const { data, error, reload } = useLoad(
    'learn',
    async () => {
      const mastered = await masteredIds(progress);
      const [path, grammar, words, tests] = await Promise.all([
        loadPath(content, progress, settings.placementLevel, mastered),
        content.countKind('grammar'),
        content.countKind('word'),
        content.countKind('checkpoint'),
      ]);
      return { path, counts: { grammar, words, tests } };
    },
    [settings.placementLevel],
  );
  const { colors } = useTheme();
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { path, counts } = data;
  const s = colors.skills;

  return (
    <Screen tabs testID="learn-screen">
      <ScreenHeader title="Parcours" subtitle="Your A1 → B1 path" />
      <View style={styles.grid}>
        <Tile
          style={styles.tall}
          color={s.structures.base}
          ink={s.structures.onBase}
          icon="layers"
          title="Grammar"
          count={`${counts.grammar} points de grammaire`}
          illustration={<BooksIllustration ink={s.structures.onBase} paper="#FFFFFF" size={104} />}
          onPress={() => router.push('/grammar')}
        />
        <View style={styles.column}>
          <Tile
            color={s.vocabulary.base}
            ink={s.vocabulary.onBase}
            icon="message-square"
            title="Vocabulary"
            count={`${counts.words} mots`}
            illustration={<BubblesIllustration ink={s.vocabulary.onBase} paper="#FFFFFF" size={64} />}
            onPress={() => router.push('/search')}
          />
          <Tile
            color={s.tests.base}
            ink={s.tests.onBase}
            icon="award"
            title="Tests"
            count={`${counts.tests} questions de contrôle`}
            illustration={<HeadphonesIllustration ink={s.tests.onBase} paper="#FFFFFF" size={64} />}
            onPress={() => router.push('/practice')}
          />
        </View>
      </View>

      <SectionTitle title="Your path" />
      {path.units.map((unit) => (
        <UnitCard key={unit.id} unit={unit} current={unit.id === path.current?.id} />
      ))}
    </Screen>
  );
}

interface TileProps {
  color: string;
  ink: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  count: string;
  illustration: React.ReactNode;
  onPress: () => void;
  style?: object;
}

function Tile({ color, ink, icon, title, count, illustration, onPress, style }: TileProps) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${title}, ${count}`} style={[styles.tile, { backgroundColor: color }, style]}>
      <Feather name={icon} size={22} color={ink} />
      <View style={styles.flex}>
        <AppText variant="title" color={ink}>
          {title}
        </AppText>
        <AppText variant="meta" color={ink}>
          {count}
        </AppText>
      </View>
      <View style={styles.illustration}>{illustration}</View>
    </PressableScale>
  );
}

function UnitCard({ unit, current }: { unit: UnitOnPath; current: boolean }) {
  const { colors } = useTheme();
  const locked = unit.status === 'locked';
  const done = unit.status === 'completed';
  const progress = unit.segmentsTotal > 0 ? unit.segmentsDone / unit.segmentsTotal : 0;
  const statusText = locked ? 'Locked — pass the previous checkpoint' : done ? 'Completed' : `${unit.segmentsDone}/${unit.segmentsTotal} lessons`;
  const label = `Unit ${unit.order}, ${unit.theme}, level ${unit.level}. ${statusText}.`;

  if (current) {
    return (
      <Card padded={false} onPress={() => router.push(`/unit/${unit.id}`)} accessibilityLabel={`Current unit. ${label}`} testID={`unit-${unit.id}`}>
        <LinearGradient colors={colors.unitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.current}>
          <Row style={styles.between}>
            <AppText variant="label" color={colors.skills.unit.onBase}>{`UNIT ${unit.order} · CURRENT`}</AppText>
            <LevelPill level={unit.level} />
          </Row>
          <AppText variant="title" color={colors.skills.unit.onBase}>
            {unit.titleFr}
          </AppText>
          <AppText variant="meta" color={colors.skills.unit.onBase}>
            {unit.description}
          </AppText>
          <ProgressBar value={progress} color={colors.skills.structures.base} track="rgba(255,255,255,0.55)" />
          <AppText variant="meta" color={colors.skills.unit.onBase}>
            {`${unit.masteredWords}/${unit.coreWords} words mastered · ${statusText}`}
          </AppText>
        </LinearGradient>
      </Card>
    );
  }

  return (
    <Card
      onPress={locked ? undefined : () => router.push(`/unit/${unit.id}`)}
      accessibilityLabel={label}
      color={locked ? colors.surfaceRaised : undefined}
      testID={`unit-${unit.id}`}
    >
      <Row>
        <View style={[styles.badge, { backgroundColor: locked ? colors.border : done ? colors.successTint : colors.skills.unit.tint }]}>
          {locked ? (
            <Feather name="lock" size={18} color={colors.textMuted} />
          ) : done ? (
            <Feather name="check" size={20} color={colors.success} />
          ) : (
            <AppText variant="cardTitle" color={colors.skills.unit.onTint}>
              {String(unit.order)}
            </AppText>
          )}
        </View>
        <View style={styles.flex}>
          <AppText variant="cardTitle" tone={locked ? 'muted' : 'default'}>
            {unit.titleFr}
          </AppText>
          <AppText variant="meta" tone="muted">
            {`${unit.theme} · ${statusText}`}
          </AppText>
        </View>
        <LevelPill level={unit.level} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1, gap: spacing.md },
  tile: { flex: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, overflow: 'hidden', minHeight: 150 },
  tall: { minHeight: 312 },
  illustration: { alignSelf: 'flex-end' },
  flex: { flex: 1, gap: 2 },
  between: { justifyContent: 'space-between' },
  current: { borderRadius: radii.lg, padding: spacing.xl, gap: spacing.sm },
  badge: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
});
