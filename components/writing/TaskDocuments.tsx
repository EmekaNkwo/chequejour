import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';

/** Some titles repeat the "Document 1 –" label shown above them. */
const LABEL_PREFIX = /^Document\s+\d+\s*[–—:-]\s*/i;

/** The two opposing documents of a Task 3 writing prompt. */
export function TaskDocuments({ documents }: { documents: readonly { title: string; text: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {documents.map((d, i) => (
        <View key={d.title} style={[styles.doc, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]} accessible accessibilityLabel={`Document ${i + 1}: ${d.title}. ${d.text}`}>
          <AppText variant="label" tone="muted">{`DOCUMENT ${i + 1}`}</AppText>
          <AppText variant="bodyStrong">{d.title.replace(LABEL_PREFIX, '')}</AppText>
          <AppText variant="body" french>
            {d.text}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginTop: spacing.md },
  doc: { borderRadius: radii.md, borderWidth: 1, padding: spacing.lg, gap: spacing.xs },
});
