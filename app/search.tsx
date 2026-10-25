import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AnswerInput, type AnswerInputHandle } from '../components/exercises/inputs';
import { WordCard } from '../components/lesson/WordCard';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { ListRow, SectionTitle } from '../components/ui/Bits';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import type { UnitSummary } from '../data/content-repo';
import type { VocabItem } from '../domain/content-types';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

export default function SearchScreen() {
  const { content } = useApp();
  const input = useRef<AnswerInputHandle>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VocabItem[] | null>(null);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 300);
    content
      .units()
      .then(setUnits)
      .catch((e: unknown) => logError('search units', e));
    return () => clearTimeout(t);
  }, [content]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) return;
    let cancelled = false;
    const t = setTimeout(() => {
      content
        .search(q)
        .then((found) => {
          if (!cancelled) {
            setResults(found);
            setFailed(false);
          }
        })
        .catch((e: unknown) => {
          logError('search', e);
          if (!cancelled) setFailed(true);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, content]);

  const shown = query.trim().length >= MIN_QUERY ? results : null;

  return (
    <Screen testID="search-screen">
      <ScreenHeader title="Vocabulaire" subtitle="Search in French or English" back />
      <AnswerInput
        ref={input}
        value={query}
        onChange={setQuery}
        onSubmit={() => undefined}
        placeholder="e.g. logement, to rent"
        accessibilityLabel="Search words"
        testID="search-input"
      />

      {failed ? (
        <AppText variant="body" tone="danger">
          Search didn&apos;t work. Please try again.
        </AppText>
      ) : shown === null ? (
        <>
          <SectionTitle title="Browse by unit" />
          <View style={styles.list}>
            {units.map((u) => (
              <ListRow
                key={u.id}
                skill="vocabulary"
                icon="message-square"
                category={`Unit ${u.order} · ${u.level}`}
                title={u.titleFr}
                onPress={() => router.push(`/unit/${u.id}`)}
              />
            ))}
          </View>
        </>
      ) : shown.length === 0 ? (
        <AppText variant="body" tone="muted">
          {`No words match "${query.trim()}".`}
        </AppText>
      ) : (
        <View style={styles.list} accessibilityLiveRegion="polite">
          <AppText variant="meta" tone="muted">
            {`${shown.length}${shown.length >= 30 ? '+' : ''} result${shown.length === 1 ? '' : 's'}`}
          </AppText>
          {shown.map((w) => (
            <Card key={w.id}>
              <WordCard word={w} compact />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
