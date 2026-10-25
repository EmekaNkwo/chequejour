import { Feather } from "@expo/vector-icons";
import { ScrollView, StyleSheet, View } from "react-native";
import type { GrammarLesson } from "../../domain/content-types";
import { useTheme } from "../theme/ThemeProvider";
import { radii, spacing } from "../theme/tokens";
import { AppText } from "../ui/AppText";
import { LevelPill, Row } from "../ui/Bits";
import { Card } from "../ui/Card";

/** A grammar point: English explanation, optional rule table, examples and common mistakes. */
export function GrammarLessonView({ lesson }: { lesson: GrammarLesson }) {
  const { colors } = useTheme();
  const [header, ...rows] = lesson.table ?? [];
  return (
    <View style={styles.gap}>
      <Card>
        <Row style={styles.between}>
          <AppText variant="label" tone="muted">
            GRAMMAR
          </AppText>
          <LevelPill level={lesson.level} />
        </Row>
        <AppText variant="title" accessibilityRole="header" style={styles.mt}>
          {lesson.title}
        </AppText>
        {lesson.explanation.map((p) => (
          <AppText key={p} variant="body" tone="secondary" style={styles.mt}>
            {p}
          </AppText>
        ))}
      </Card>

      {header ? (
        <Card padded={false}>
          {/* Conjugation tables can have 7 columns: scroll sideways rather than break words. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.table}
          >
            <View style={styles.tableBody}>
              <View
                style={[
                  styles.tableRow,
                  { backgroundColor: colors.skills.structures.tint },
                ]}
              >
                {header.map((cell) => (
                  <AppText
                    key={cell}
                    variant="label"
                    color={colors.skills.structures.onTint}
                    style={styles.cell}
                  >
                    {cell}
                  </AppText>
                ))}
              </View>
              {rows.map((row, i) => (
                <View
                  key={row.join("|")}
                  style={[
                    styles.tableRow,
                    i % 2 === 1 && { backgroundColor: colors.surfaceRaised },
                  ]}
                >
                  {row.map((cell, j) => (
                    <AppText
                      key={`${j}-${cell}`}
                      variant={j === 0 ? "bodyStrong" : "body"}
                      french
                      style={styles.cell}
                    >
                      {cell}
                    </AppText>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </Card>
      ) : null}

      <Card>
        <AppText variant="cardTitle">Examples</AppText>
        {lesson.examples.map((ex) => (
          <View key={ex.fr} style={styles.example}>
            <AppText variant="french" french>
              {ex.fr}
            </AppText>
            <AppText variant="body" tone="secondary">
              {ex.en}
            </AppText>
          </View>
        ))}
      </Card>

      {lesson.commonMistakes.length > 0 ? (
        <Card>
          <AppText variant="cardTitle">Common mistakes</AppText>
          {lesson.commonMistakes.map((m) => (
            <View key={m.wrong} style={styles.example}>
              <Row gap={spacing.sm}>
                <Feather name="x" size={16} color={colors.danger} />
                <AppText
                  variant="body"
                  tone="danger"
                  french
                  style={[styles.flex, styles.strike]}
                  accessibilityLabel={`Wrong: ${m.wrong}`}
                >
                  {m.wrong}
                </AppText>
              </Row>
              <Row gap={spacing.sm}>
                <Feather name="check" size={16} color={colors.success} />
                <AppText
                  variant="bodyStrong"
                  tone="success"
                  french
                  style={styles.flex}
                  accessibilityLabel={`Right: ${m.right}`}
                >
                  {m.right}
                </AppText>
              </Row>
              <AppText variant="meta" tone="muted">
                {m.why}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.lg },
  between: { justifyContent: "space-between" },
  mt: { marginTop: spacing.sm },
  flex: { flex: 1 },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderRadius: radii.sm,
  },
  table: { minWidth: "100%" },
  tableBody: { flexGrow: 1 },
  cell: { flexGrow: 1, flexBasis: 0, minWidth: 76 },
  example: { marginTop: spacing.md, gap: 2 },
  strike: { textDecorationLine: "line-through" },
});
