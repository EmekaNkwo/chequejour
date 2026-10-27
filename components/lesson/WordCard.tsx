import { StyleSheet, View } from 'react-native';
import { audioKey, headword } from '../../domain/audio-keys';
import type { VocabItem } from '../../domain/content-types';
import { PlayButton } from '../audio/AudioControls';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { GenderTag, LevelPill, Row } from '../ui/Bits';

export const HIDDEN_MEANING = 'Meaning hidden until you answer the test.';

export interface WordCardProps {
  word: VocabItem;
  /** Compact rows for lists; full cards show the example sentence. */
  compact?: boolean;
  /** Hides the English while the learner is being tested on it. */
  hideMeaning?: boolean;
}

/** A vocabulary item: headword with article, gender, plural, meaning and example, each with audio. */
export function WordCard({ word, compact = false, hideMeaning = false }: WordCardProps) {
  const { colors } = useTheme();
  const head = headword(word);
  return (
    <View style={styles.gap}>
      <Row style={styles.between}>
        <View style={styles.flex}>
          <AppText variant={compact ? 'french' : 'frenchLarge'} french>
            {head}
          </AppText>
        </View>
        <PlayButton audioKey={audioKey.word(word.id)} text={head} size={compact ? 44 : 52} label={`Play ${head}`} />
      </Row>
      <Row gap={spacing.sm} style={styles.wrap}>
        <GenderTag gender={word.gender} />
        <AppText variant="meta" tone="muted">
          {word.pos}
        </AppText>
        {word.plural && !word.pluralOnly ? (
          <AppText variant="meta" tone="muted" french>
            {`pl. ${word.plural}`}
          </AppText>
        ) : null}
        {compact ? null : <LevelPill level={word.level} />}
      </Row>
      <AppText variant="bodyStrong" tone={hideMeaning ? 'muted' : 'secondary'}>
        {hideMeaning ? HIDDEN_MEANING : word.en}
      </AppText>
      {compact ? null : (
        <View style={[styles.example, { backgroundColor: colors.surfaceRaised }]}>
          <Row style={styles.between}>
            <View style={styles.flex}>
              <AppText variant="french" french>
                {word.example.fr}
              </AppText>
              {hideMeaning ? null : (
                <AppText variant="body" tone="secondary">
                  {word.example.en}
                </AppText>
              )}
            </View>
            <PlayButton
              audioKey={audioKey.example(word.id)}
              text={word.example.fr}
              size={44}
              label="Play example sentence"
              color={colors.primaryTint}
              iconColor={colors.primary}
            />
          </Row>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  between: { justifyContent: 'space-between', alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  wrap: { flexWrap: 'wrap' },
  example: { borderRadius: radii.md, padding: spacing.lg, marginTop: spacing.sm },
});
