import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LinkText, ListRow, SectionTitle } from '../../components/ui/Bits';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { GRAMMAR_TAGS, GRAMMAR_TAG_LABELS, type GrammarTag } from '../../domain/content-types';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';

const isTag = (v: string | undefined): v is GrammarTag => !!v && (GRAMMAR_TAGS as readonly string[]).includes(v);

export default function GrammarIndexScreen() {
  const { content } = useApp();
  const params = useLocalSearchParams<{ tag?: string }>();
  const tag = isTag(params.tag) ? params.tag : null;
  const { data, error, reload } = useLoad(
    'grammar index',
    async () => {
      const [units, lessons] = await Promise.all([content.units(), content.listKind('grammar')]);
      return units
        .map((u) => ({ unit: u, lessons: lessons.filter((l) => l.id.startsWith(`${u.id}-`) && (tag === null || l.grammarTag === tag)) }))
        .filter((g) => g.lessons.length > 0);
    },
    [tag],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const count = data.reduce((n, g) => n + g.lessons.length, 0);

  return (
    <Screen testID="grammar-screen">
      <ScreenHeader title="Grammaire" subtitle={tag ? `${GRAMMAR_TAG_LABELS[tag]} · ${count} lesson${count === 1 ? '' : 's'}` : `${count} points de grammaire`} back />
      {tag ? <LinkText label="Show all grammar points" icon="x" onPress={() => router.setParams({ tag: '' })} /> : null}
      {data.length === 0 ? (
        <AppText variant="body" tone="muted">
          No lessons for this grammar point yet.
        </AppText>
      ) : null}
      {data.map(({ unit, lessons }) => (
        <View key={unit.id} style={styles.group}>
          <SectionTitle title={`Unit ${unit.order} · ${unit.theme}`} />
          {lessons.map((l) => (
            <ListRow
              key={l.id}
              skill="structures"
              icon="layers"
              category={`${l.level} · ${GRAMMAR_TAG_LABELS[l.grammarTag]}`}
              title={l.title}
              onPress={() => router.push(`/grammar/${l.id}`)}
              testID={`grammar-${l.id}`}
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md },
});
