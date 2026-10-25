import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../components/theme/ThemeProvider';
import { radii, spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LevelPill, ListRow, Row, SectionTitle, SkillThumb, SKILL_LABEL } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/Progress';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import type { Unit } from '../../domain/content-types';
import { CHECKPOINT_PASS, unitSegments, type Segment } from '../../domain/unit-path';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { loadPath, type UnitOnPath } from '../../features/path/path-service';
import { masteredIds } from '../../features/session/session-service';

type SkillKind = 'listening' | 'reading' | 'writing' | 'speaking';

const SKILL_KINDS: readonly SkillKind[] = ['listening', 'reading', 'writing', 'speaking'];

const ROW_ICON = { listening: 'play', reading: 'book-open', writing: 'edit-3', speaking: 'mic' } as const;

const pct = (n: number): string => `${Math.round(n * 100)}%`;

export default function UnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content, progress, settings } = useApp();
  const { data, error, loading, reload } = useLoad(
    'unit',
    async () => {
      const unit = await content.unit(id ?? '');
      if (!unit) return null;
      const path = await loadPath(content, progress, settings.placementLevel, await masteredIds(progress));
      const onPath = path.units.find((u) => u.id === unit.id);
      if (!onPath) return null;
      const done = await progress.skillProgress();
      const doneSkills = new Set([...done.values()].filter((p) => p.lastDoneAt !== null).map((p) => p.itemId));
      return { unit, onPath, completed: path.completedSegments, doneSkills };
    },
    [id, settings.placementLevel],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : <ErrorState message="This unit couldn't be found." />;
  return <UnitView unit={data.unit} onPath={data.onPath} completed={data.completed} doneSkills={data.doneSkills} />;
}

interface UnitViewProps {
  unit: Unit;
  onPath: UnitOnPath;
  completed: ReadonlySet<string>;
  doneSkills: ReadonlySet<string>;
}

function UnitView({ unit, onPath, completed, doneSkills }: UnitViewProps) {
  const { colors } = useTheme();
  const locked = onPath.status === 'locked';
  const segments = unitSegments(unit);
  const progressValue = onPath.segmentsTotal > 0 ? onPath.segmentsDone / onPath.segmentsTotal : 0;
  const best = onPath.checkpointScore;

  return (
    <Screen testID="unit-screen">
      <ScreenHeader title={`Unit ${unit.order}`} back />
      <Card padded={false}>
        <LinearGradient colors={colors.unitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Row style={styles.between}>
            <AppText variant="label" color={colors.skills.unit.onBase}>
              {unit.theme.toUpperCase()}
            </AppText>
            <LevelPill level={unit.level} />
          </Row>
          <AppText variant="title" french color={colors.skills.unit.onBase}>
            {unit.titleFr}
          </AppText>
          <AppText variant="body" color={colors.skills.unit.onBase}>
            {unit.description}
          </AppText>
          <ProgressBar value={progressValue} color={colors.skills.structures.base} track="rgba(255,255,255,0.55)" />
          <AppText variant="meta" color={colors.skills.unit.onBase}>
            {`${onPath.segmentsDone}/${onPath.segmentsTotal} lessons · ${onPath.masteredWords}/${onPath.coreWords} words mastered`}
          </AppText>
        </LinearGradient>
      </Card>

      {locked ? (
        <Card accessibilityLabel="This unit is locked. Pass the previous unit's checkpoint to open it.">
          <Row>
            <Feather name="lock" size={22} color={colors.textMuted} />
            <View style={styles.flex}>
              <AppText variant="cardTitle">Locked</AppText>
              <AppText variant="body" tone="secondary">
                Pass the previous unit&apos;s checkpoint to open this unit.
              </AppText>
            </View>
          </Row>
        </Card>
      ) : (
        <>
          <SectionTitle title="Lessons" />
          {segments.map((s, i) => (
            <SegmentRow key={s.id} segment={s} index={i} done={completed.has(s.id)} />
          ))}

          <SectionTitle title="Skills" />
          {SKILL_KINDS.flatMap((kind) =>
            unit[kind].map((item) => (
              <ListRow
                key={item.id}
                skill={kind}
                category={`${SKILL_LABEL[kind]} · ${item.level}`}
                title={item.title}
                right={doneSkills.has(item.id) ? 'Done' : undefined}
                progress={doneSkills.has(item.id) ? 1 : 0}
                icon={ROW_ICON[kind]}
                onPress={() => router.push(`/${kind}/${item.id}`)}
                testID={`unit-item-${item.id}`}
              />
            )),
          )}
          {unit.exercises.length > 0 ? (
            <ListRow
              skill="structures"
              category="Language structures"
              title={`Grammar drill · ${unit.theme}`}
              icon="layers"
              onPress={() => router.push(`/drill/${unit.id}`)}
            />
          ) : null}

          <SectionTitle title="Checkpoint" />
          <Card
            accessibilityLabel={`Checkpoint quiz, ${unit.checkpoint.length} questions. Pass mark ${pct(CHECKPOINT_PASS)}. ${best === null ? 'Not taken yet.' : `Best score ${pct(best)}.`}`}
          >
            <Row>
              <SkillThumb skill="tests" />
              <View style={styles.flex}>
                <AppText variant="cardTitle">{`Checkpoint · ${unit.checkpoint.length} questions`}</AppText>
                <AppText variant="meta" tone="muted">
                  {best === null ? `Pass mark ${pct(CHECKPOINT_PASS)}` : `Best ${pct(best)} · pass mark ${pct(CHECKPOINT_PASS)}`}
                </AppText>
              </View>
              {onPath.status === 'completed' ? <Feather name="check-circle" size={24} color={colors.success} /> : null}
            </Row>
            {onPath.segmentsDone < onPath.segmentsTotal && onPath.status !== 'completed' ? (
              <AppText variant="meta" tone="muted" style={styles.mt}>
                Finish the lessons first for the best chance — but you can try it any time.
              </AppText>
            ) : null}
            <Button
              label={best === null ? 'Take the checkpoint' : 'Retake the checkpoint'}
              icon="award"
              variant={onPath.segmentsDone >= onPath.segmentsTotal ? 'primary' : 'secondary'}
              onPress={() => router.push(`/checkpoint/${unit.id}`)}
              style={styles.mt}
              testID="start-checkpoint"
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

function SegmentRow({ segment, index, done }: { segment: Segment; index: number; done: boolean }) {
  const { colors } = useTheme();
  const skill = segment.kind === 'words' ? 'vocabulary' : 'structures';
  const kindLabel = segment.kind === 'words' ? 'Vocabulary' : segment.kind === 'grammar' ? 'Grammar' : 'Practice';
  return (
    <Card
      onPress={() => router.push(`/lesson/${encodeURIComponent(segment.id)}`)}
      accessibilityLabel={`Lesson ${index + 1}: ${segment.title}. ${kindLabel}. ${done ? 'Done' : 'Not done yet'}.`}
      testID={`segment-${segment.id}`}
    >
      <Row>
        <SkillThumb skill={skill} size={44} icon={segment.kind === 'words' ? 'message-square' : segment.kind === 'grammar' ? 'book' : 'edit'} />
        <View style={styles.flex}>
          <AppText variant="label" tone="muted">
            {kindLabel.toUpperCase()}
          </AppText>
          <AppText variant="cardTitle">{segment.title}</AppText>
        </View>
        <Feather name={done ? 'check-circle' : 'chevron-right'} size={22} color={done ? colors.success : colors.textMuted} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radii.lg, padding: spacing.xl, gap: spacing.sm },
  between: { justifyContent: 'space-between' },
  flex: { flex: 1, gap: 2 },
  mt: { marginTop: spacing.md },
});
