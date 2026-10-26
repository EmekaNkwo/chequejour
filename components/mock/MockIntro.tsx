/**
 * Mock test start page: take all four tests in a row, or one test on its own.
 */
import { StyleSheet, View } from 'react-native';
import type { MockTest } from '../../domain/content-types';
import { TCF_CANADA, TCF_SKILLS, testMinutes, type TcfSkill } from '../../domain/tcf/exam-format';
import type { MockRunRecord } from '../../domain/tcf/mock-scoring';
import { NCLC_DISCLAIMER } from '../../domain/tcf/nclc';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Pill, Row, SectionTitle, SKILL_ICON } from '../ui/Bits';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Screen } from '../ui/Screen';
import { ScreenHeader } from '../ui/ScreenHeader';
import { MockHistory } from './MockHistory';

function testSummary(skill: TcfSkill): string {
  switch (skill) {
    case 'listening':
      return `${TCF_CANADA.listening.questions} questions · rising difficulty · each recording plays once`;
    case 'reading':
      return `${TCF_CANADA.reading.questions} questions · rising difficulty`;
    case 'writing':
      return `${TCF_CANADA.writing.tasks.length} tasks · one clock for all`;
    case 'speaking':
      return `${TCF_CANADA.speaking.tasks.length} tasks · recorded on your phone`;
  }
}

export interface MockIntroProps {
  mock: MockTest;
  history: readonly MockRunRecord[];
  titles: ReadonlyMap<string, string>;
  onStart: (skills: TcfSkill[]) => void;
}

export function MockIntro({ mock, history, titles, onStart }: MockIntroProps) {
  const { colors } = useTheme();
  const total = TCF_SKILLS.reduce((n, s) => n + testMinutes(s), 0);
  return (
    <Screen testID="mock-intro" footer={<Button label="Start the full mock" icon="play" onPress={() => onStart([...TCF_SKILLS])} testID="mock-start" />}>
      <ScreenHeader title={mock.title} back subtitle={`TCF Canada format · 4 tests · about ${total} minutes`} />
      <Card>
        <AppText variant="cardTitle">How it works</AppText>
        <AppText variant="body" tone="secondary" style={styles.mt}>
          Each test has its own clock, as in the real exam, and ends by itself when time runs out. Unanswered questions count as wrong. You see answers and explanations at the end. Writing and speaking are self-assessed against model answers.
        </AppText>
      </Card>
      <SectionTitle title="Or take one test" />
      {TCF_SKILLS.map((skill, i) => {
        const f = TCF_CANADA[skill];
        return (
          <Card key={skill} onPress={() => onStart([skill])} accessibilityLabel={`Take only ${f.title}: ${testSummary(skill)}, ${testMinutes(skill)} minutes`} testID={`mock-single-${skill}`}>
            <Row>
              <Pill label={`${i + 1}`} color={colors.skills[skill].tint} textColor={colors.skills[skill].onTint} icon={SKILL_ICON[skill]} />
              <View style={styles.flex}>
                <AppText variant="cardTitle">{f.titleFr}</AppText>
                <AppText variant="meta" tone="muted">
                  {testSummary(skill)}
                </AppText>
              </View>
              <AppText variant="bodyStrong">{`${testMinutes(skill)} min`}</AppText>
            </Row>
          </Card>
        );
      })}
      <SectionTitle title="Your mock results" />
      <MockHistory runs={history} titles={titles} />
      <AppText variant="meta" tone="muted">
        {NCLC_DISCLAIMER}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  mt: { marginTop: spacing.sm },
});
