import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Logo } from '../components/brand/Logo';
import { QuizRunner, type QuizScore } from '../components/exercises/QuizRunner';
import { useTheme } from '../components/theme/ThemeProvider';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Row, SegmentedTabs } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { useToast } from '../components/ui/Toast';
import type { Level } from '../domain/content-types';
import { placementLevel } from '../domain/level';
import type { DailyGoal } from '../domain/session';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';
import { useLoad } from '../features/app/useLoad';
import { requestNotificationPermission } from '../features/notifications/expo-notifications-api';
import { importFromFile } from '../features/settings/backup-files';

type Step = 'welcome' | 'setup' | 'placement' | 'result';

const GOALS: readonly { value: `${DailyGoal}`; label: string }[] = [
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '20', label: '20 min' },
];

export default function Onboarding() {
  const app = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [level, setLevel] = useState<Level>('A2');
  const questions = useLoad('placement', () => app.content.listKind('placement'), []);

  const finish = async (placement: Level | null) => {
    try {
      await app.updateSetting('placementLevel', placement);
      await app.updateSetting('onboarded', true);
      router.replace('/');
    } catch (e: unknown) {
      logError('finish onboarding', e);
    }
  };

  if (step === 'placement') {
    if (questions.error) return <ErrorState message={questions.error} onRetry={questions.reload} />;
    if (!questions.data) return <Loading />;
    const onFinish = (score: QuizScore) => {
      const byId = new Map(score.results.map((r) => [r.exerciseId, r.correct]));
      const band = (b: Level) => {
        const qs = (questions.data ?? []).filter((q) => q.band === b);
        return { correct: qs.filter((q) => byId.get(q.id)).length, total: qs.length };
      };
      setLevel(placementLevel({ A2: band('A2'), 'A2+': band('A2+'), B1: band('B1') }));
      setStep('result');
    };
    return (
      <QuizRunner
        title="Placement test"
        exercises={questions.data}
        context="placement"
        unitId={null}
        showFeedback={false}
        onFinish={onFinish}
        onClose={() => setStep('setup')}
      />
    );
  }

  if (step === 'result') return <PlacementResult level={level} onContinue={() => finish(level)} />;
  if (step === 'setup') return <Setup onPlacement={() => setStep('placement')} onSkip={() => finish(null)} />;
  return <Welcome onNext={() => setStep('setup')} />;
}

function Welcome({ onNext }: { onNext: () => void }) {
  const { colors } = useTheme();
  const app = useApp();
  const toast = useToast();
  const [restoring, setRestoring] = useState(false);
  // A new phone (or a reset) starts here, so a backup must be restorable without redoing placement.
  const restore = async () => {
    setRestoring(true);
    try {
      const result = await importFromFile(app.db);
      if (result === null) return;
      if (!result.ok) {
        toast.show({ tone: 'error', title: 'Backup not restored', message: result.error });
        return;
      }
      await app.reloadSettings();
      await app.updateSetting('onboarded', true);
      router.replace('/');
      toast.show({ tone: 'success', title: 'Welcome back', message: `Progress restored (${result.rows} records).` });
    } catch (e: unknown) {
      logError('restore backup', e);
      toast.show({ tone: 'error', title: 'Backup not restored', message: "That file couldn't be read." });
    } finally {
      setRestoring(false);
    }
  };
  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Get started" onPress={onNext} testID="onboarding-start" />
          <Button label="Restore from a backup" variant="secondary" icon="download" onPress={() => void restore()} loading={restoring} testID="onboarding-restore" />
        </View>
      }
      testID="onboarding"
    >
      <View style={styles.hero}>
        <Logo size={80} />
        <AppText variant="screenTitle">Chèque du jour</AppText>
        <AppText variant="body" tone="secondary">
          A calm daily French habit, from A2 to B1, built around the TCF.
        </AppText>
      </View>
      {[
        { t: 'Ten to twenty minutes a day', d: 'Reviews, one lesson and one skill exercise, planned for you.' },
        { t: 'A word and a sentence every day', d: 'Gentle reminders at the times you choose.' },
        { t: 'Fully offline and private', d: 'No account, no internet, no tracking. Everything stays on this phone.' },
      ].map((x) => (
        <Card key={x.t} color={colors.surface}>
          <AppText variant="cardTitle">{x.t}</AppText>
          <AppText variant="body" tone="secondary">
            {x.d}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}

function Setup({ onPlacement, onSkip }: { onPlacement: () => void; onSkip: () => void }) {
  const app = useApp();
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const n = app.settings.notifications;
  const ask = async () => {
    try {
      const status = await requestNotificationPermission();
      setPermission(status === 'undetermined' ? 'unknown' : status);
    } catch (e: unknown) {
      logError('notification permission', e);
      setPermission('denied');
    }
  };
  const fmt = (t: { hour: number; minute: number }) => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Take the placement test (5 min)" onPress={onPlacement} testID="start-placement" />
          <Button label="Skip — start at A2" variant="ghost" onPress={onSkip} testID="skip-placement" />
        </View>
      }
    >
      <AppText variant="screenTitle">Set up</AppText>
      <Card>
        <AppText variant="cardTitle">Daily goal</AppText>
        <AppText variant="meta" tone="muted" style={styles.mb}>
          How long is your daily session?
        </AppText>
        <SegmentedTabs options={GOALS} value={`${app.settings.dailyGoal}`} onChange={(v) => void app.updateSetting('dailyGoal', Number(v) as DailyGoal)} />
      </Card>
      <Card>
        <AppText variant="cardTitle">Daily reminders</AppText>
        <AppText variant="body" tone="secondary">
          {`Word of the Day at ${fmt(n.word.time)} and Sentence of the Day at ${fmt(n.sentence.time)}. You can change the times or turn them off in Settings.`}
        </AppText>
        <Row style={styles.mt}>
          {permission === 'granted' ? (
            <AppText variant="bodyStrong" tone="success">
              Reminders are on.
            </AppText>
          ) : permission === 'denied' ? (
            <AppText variant="body" tone="secondary">
              Notifications are off. You can allow them later in Settings.
            </AppText>
          ) : (
            <Button label="Allow reminders" variant="secondary" icon="bell" onPress={ask} testID="allow-notifications" />
          )}
        </Row>
      </Card>
      <Card>
        <AppText variant="cardTitle">Find your level</AppText>
        <AppText variant="body" tone="secondary">
          24 short questions place you on the path. Your result is a practice estimate, not an official TCF score.
        </AppText>
      </Card>
    </Screen>
  );
}

function PlacementResult({ level, onContinue }: { level: Level; onContinue: () => void }) {
  const where = level === 'B1' ? 'unit 11' : level === 'A2+' ? 'unit 6' : 'unit 1';
  return (
    <Screen footer={<Button label="Start learning" onPress={onContinue} testID="placement-continue" />}>
      <AppText variant="screenTitle">{`Your level: ${level}`}</AppText>
      <Card>
        <AppText variant="body">{`We'll start you at ${where}. Earlier units stay open if you want to revise.`}</AppText>
        <AppText variant="meta" tone="muted" style={styles.mt}>
          This is a practice estimate based on 24 questions. It is not an official TCF score and it will update as you study.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.md, paddingVertical: spacing.xxl },
  footer: { gap: spacing.xs },
  mt: { marginTop: spacing.md },
  mb: { marginBottom: spacing.md },
});
