/**
 * What a learner sees after handing in a text: the offline "possible" hints, their text
 * next to the model answer, and their earlier submissions for the same task.
 */
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { WritingSubmission } from '../../data/progress-repo';
import type { WritingTask } from '../../domain/content-types';
import { writingHints, type WritingHint } from '../../domain/writing/hints';
import { countWords } from '../../domain/writing/word-count';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { loadNounGenders, type NounGenders } from '../../features/writing/writing-service';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { LinkText, Row } from '../ui/Bits';
import { Card } from '../ui/Card';

/** Noun genders from the course vocabulary, or null while loading. */
export function useNounGenders(): NounGenders | null {
  const { content } = useApp();
  const [genders, setGenders] = useState<NounGenders | null>(null);
  useEffect(() => {
    let live = true;
    loadNounGenders(content)
      .then((g) => live && setGenders(g))
      .catch((e: unknown) => logError('load noun genders', e));
    return () => {
      live = false;
    };
  }, [content]);
  return genders;
}

export function HintList({ hints }: { hints: readonly WritingHint[] }) {
  const { colors } = useTheme();
  return (
    <View testID="writing-hints">
      <AppText variant="cardTitle">Possible improvements</AppText>
      <AppText variant="meta" tone="muted">
        Simple checks run on this phone. They are not a score and can be wrong, so treat each one as a question to look at.
      </AppText>
      {hints.map((h) => (
        <Row key={h.kind} gap={spacing.sm} style={styles.hint}>
          <Feather
            name={h.tone === 'ok' ? 'check-circle' : 'help-circle'}
            size={18}
            color={h.tone === 'ok' ? colors.success : colors.skills.vocabulary.onTint}
          />
          <AppText variant="body" style={styles.flex}>
            {h.message}
          </AppText>
        </Row>
      ))}
    </View>
  );
}

/** Hints for a text, computed once the vocabulary is loaded. */
export function TextHints({ text, taskType }: { text: string; taskType: WritingTask['taskType'] }) {
  const genders = useNounGenders();
  if (!genders || !text.trim()) return null;
  return <HintList hints={writingHints(text, { taskType, nounGenders: genders })} />;
}

/** Learner text and model answer next to each other; stacked on narrow phones in portrait. */
export function SideBySide({ yours, model }: { yours: string; model: string }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const columns = width >= 600;
  const pane = (label: string, text: string) => (
    <View style={[styles.pane, columns && styles.flex, { backgroundColor: colors.surfaceRaised }]}>
      <AppText variant="meta" tone="muted">{`${label} · ${countWords(text)} words`}</AppText>
      <AppText variant="body" french style={styles.mtXs}>
        {text}
      </AppText>
    </View>
  );
  return (
    <View style={columns ? styles.columns : styles.stack} testID="side-by-side">
      {pane('Your text', yours)}
      {pane('Model answer', model)}
    </View>
  );
}

const when = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

/** Earlier hand-ins for this task, so the learner can see their writing change. */
export function PastSubmissions({ submissions }: { submissions: readonly WritingSubmission[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (submissions.length === 0) return null;
  return (
    <Card testID="past-submissions">
      <AppText variant="cardTitle">Your earlier versions</AppText>
      {submissions.map((s) => (
        <View key={s.id} style={styles.mt}>
          <Row style={styles.between}>
            <AppText variant="body">{`${when(s.createdAt)} · ${s.words} words · ${s.hints} tip${s.hints === 1 ? '' : 's'}`}</AppText>
            <LinkText label={open === s.id ? 'Hide' : 'Read'} onPress={() => setOpen((o) => (o === s.id ? null : s.id))} />
          </Row>
          {open === s.id ? (
            <AppText variant="body" french tone="secondary" style={styles.mtXs}>
              {s.text}
            </AppText>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
  mtXs: { marginTop: spacing.xs },
  hint: { alignItems: 'flex-start', marginTop: spacing.sm },
  between: { justifyContent: 'space-between' },
  columns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  stack: { gap: spacing.sm, marginTop: spacing.sm },
  pane: { borderRadius: radii.md, padding: spacing.md },
});
