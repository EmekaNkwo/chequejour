import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { ListRow, SectionTitle, SegmentedTabs, SKILL_LABEL } from '../../components/ui/Bits';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import type { SkillItemSummary } from '../../data/content-repo';
import { TCF_SKILLS, testMinutes } from '../../domain/tcf/exam-format';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { dailyLearner, loadPath } from '../../features/path/path-service';
import { levelOverview } from '../../features/progress/stats-service';
import { masteredIds } from '../../features/session/session-service';
import { trainerOverview } from '../../features/conjugation/trainer-service';
import { verbOfDay } from '../../domain/verb-of-day';

type Filter = 'all' | SkillItemSummary['kind'] | 'saved';

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'listening', label: 'Listen' },
  { value: 'reading', label: 'Read' },
  { value: 'writing', label: 'Write' },
  { value: 'speaking', label: 'Speak' },
  { value: 'saved', label: 'Saved' },
];

/** Rough speaking time of a listening script (150 words a minute). */
function minutes(words: number): string {
  return `${Math.max(1, Math.round(words / 150))} min`;
}

const MOCK_MINUTES = TCF_SKILLS.reduce((n, s) => n + testMinutes(s), 0);

export default function PracticeScreen() {
  const { db, content, progress, settings, today } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, error, reload } = useLoad(
    'practice',
    async () => {
      const mastered = await masteredIds(progress);
      const path = await loadPath(content, progress, settings.placementLevel, mastered);
      const [items, done, level, listening, mocks, trainer] = await Promise.all([
        content.skillItems(),
        progress.skillProgress(),
        levelOverview(progress, path, settings.placementLevel, mastered.size),
        content.listKind('listening'),
        content.listKind('mock'),
        trainerOverview({ db }, Date.now()),
      ]);
      const words = new Map(listening.map((l) => [l.id, l.lines.reduce((n, line) => n + line.fr.split(/\s+/).length, 0)]));
      const open = new Set(path.units.filter((u) => u.status !== 'locked').map((u) => u.id));
      const themes = new Map(path.units.map((u) => [u.id, u.theme]));
      const verb = verbOfDay(today, dailyLearner(path).level);
      return { items, done, level, words, open, themes, mocks, trainer, verb };
    },
    [settings.placementLevel, today],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const mockOpen = data.level.mockUnlocked || settings.examDate !== null;

  const visible = data.items.filter((i) => {
    if (filter === 'saved') return data.done.get(i.id)?.saved;
    return filter === 'all' || i.kind === filter;
  });

  const row = (item: SkillItemSummary) => {
    const p = data.done.get(item.id);
    const locked = !data.open.has(item.unitId);
    const right =
      item.kind === 'listening' ? minutes(data.words.get(item.id) ?? 0) : p?.lastDoneAt ? 'Done' : item.level;
    const progressValue = item.kind === 'listening' ? p?.playedFraction ?? 0 : p?.lastDoneAt ? 1 : 0;
    return (
      <ListRow
        key={item.id}
        skill={item.kind}
        category={`${SKILL_LABEL[item.kind]} · ${data.themes.get(item.unitId) ?? ''}`}
        title={item.title}
        right={right}
        progress={progressValue}
        icon={item.kind === 'listening' ? 'play' : item.kind === 'speaking' ? 'mic' : item.kind === 'writing' ? 'edit-3' : 'book-open'}
        locked={locked}
        onPress={() => router.push(`/${item.kind}/${item.id}`)}
        testID={`practice-${item.id}`}
      />
    );
  };

  return (
    <Screen tabs testID="practice-screen">
      <ScreenHeader title="Pratique" subtitle="Everything works offline" />
      <SegmentedTabs options={FILTERS} value={filter} onChange={setFilter} />

      {filter === 'all' ? (
        <>
          <SectionTitle title="Mock tests" />
          {data.mocks.map((m) => (
            <ListRow
              key={m.id}
              skill="tests"
              category="TCF Canada format · 4 timed tests"
              title={m.title}
              right={`${MOCK_MINUTES} min`}
              icon={mockOpen ? 'award' : undefined}
              locked={!mockOpen}
              accessibilityLabel={mockOpen ? `Mock test ${m.title}` : `Mock test ${m.title}. Locked: unlocks near B1, when all A2 units are complete, or once you set an exam date.`}
              onPress={() => router.push(`/mock/${m.id}`)}
              testID={`practice-mock-${m.id}`}
            />
          ))}
          {!mockOpen ? (
            <AppText variant="meta" tone="muted">
              Mock tests unlock as your estimate approaches B1, once every A2 and A2+ unit is complete, or as soon as you set your exam date in Settings.
            </AppText>
          ) : null}
          <ListRow skill="structures" category="Mistakes notebook" title="Review your mistakes" icon="repeat" onPress={() => router.push('/mistakes')} />
          <ListRow skill="speaking" category="Speaking task 2" title="Asking questions drill" icon="help-circle" onPress={() => router.push('/questions')} testID="practice-questions" />
          <ListRow skill="listening" category="Listening" title="Dictation" icon="edit-3" onPress={() => router.push('/dictation')} testID="practice-dictation" />
          <SectionTitle title="Conjugation" />
          <ListRow
            skill="structures"
            category="Conjugation trainer · 10 forms a round"
            title={data.trainer.due > 0 ? `${data.trainer.due} form${data.trainer.due === 1 ? '' : 's'} to review` : 'Practise your verbs'}
            right={data.trainer.due > 0 ? 'Due' : undefined}
            icon="zap"
            onPress={() => router.push('/verb-trainer')}
            testID="practice-trainer"
          />
          <ListRow
            skill="structures"
            category="Verbe du jour"
            title={`Practise ${data.verb.infinitive} in every tense`}
            right={data.verb.en}
            icon="sun"
            onPress={() => router.push({ pathname: '/verb-trainer', params: { verb: data.verb.infinitive } })}
            testID="practice-verb-of-day"
          />
          <ListRow skill="structures" category="Reference" title="Conjugation tables" icon="grid" onPress={() => router.push('/conjugation')} testID="practice-conjugation" />
        </>
      ) : null}

      <SectionTitle title={filter === 'saved' ? 'Saved' : filter === 'all' ? 'Library' : SKILL_LABEL[filter]} />
      {visible.length === 0 ? (
        <AppText variant="body" tone="muted">
          {filter === 'saved' ? 'Nothing saved yet. Use the bookmark on any listening or reading item.' : 'Nothing here yet.'}
        </AppText>
      ) : (
        <View style={{ gap: spacing.md }}>{visible.map(row)}</View>
      )}
    </Screen>
  );
}
