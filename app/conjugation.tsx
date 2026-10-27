import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../components/theme/ThemeProvider';
import { radii, spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { PressableScale } from '../components/ui/PressableScale';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { conjugate, findVerb, PERSONS, TENSES, VERBS, withPronoun } from '../domain/exercises/conjugation-tables';

/** Conjugation tables for the most common verbs, in the six tenses the drills use. */
export default function ConjugationScreen() {
  const { verb: initial } = useLocalSearchParams<{ verb?: string }>();
  const { colors } = useTheme();
  const [selected, setSelected] = useState(() => findVerb(initial ?? '') ?? VERBS[0]);

  return (
    <Screen testID="conjugation-screen">
      <ScreenHeader title="Conjugation" subtitle="Tables for common verbs" back />
      <View style={styles.verbs} accessibilityRole="tablist">
        {VERBS.map((v) => {
          const active = v === selected;
          return (
            <PressableScale
              key={v.infinitive}
              onPress={() => setSelected(v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${v.infinitive}, ${v.en}`}
              style={[styles.verb, { backgroundColor: active ? colors.skills.structures.tint : colors.surface, borderColor: active ? colors.skills.structures.onTint : colors.border }]}
              testID={`verb-${v.infinitive}`}
            >
              <AppText variant="bodyStrong" french color={active ? colors.skills.structures.onTint : colors.text}>
                {v.infinitive}
              </AppText>
            </PressableScale>
          );
        })}
      </View>

      <View>
        <AppText variant="title" french>
          {selected.infinitive}
        </AppText>
        <AppText variant="body" tone="secondary">
          {`${selected.en} · passé composé with ${selected.aux}`}
        </AppText>
      </View>

      {TENSES.map((tense) => (
        <Card key={tense} accessibilityLabel={`${selected.infinitive}, ${tense}`}>
          <AppText variant="cardTitle">{tense}</AppText>
          {conjugate(selected, tense).map((form, i) => (
            <AppText key={PERSONS[i]} variant="french" french style={styles.form}>
              {withPronoun(form, i, tense)}
            </AppText>
          ))}
        </Card>
      ))}
      <AppText variant="meta" tone="muted">
        (e) and (e)s: with être, the past participle agrees with the subject, e.g. elle est allée, ils sont allés.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  verbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  verb: { minHeight: 44, borderRadius: radii.pill, borderWidth: 1.5, paddingHorizontal: spacing.md, justifyContent: 'center' },
  form: { marginTop: spacing.xs },
});
