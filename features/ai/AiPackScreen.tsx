import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { SettingsGroup, SwitchRow } from '../../components/settings/SettingRows';
import { useTheme } from '../../components/theme/ThemeProvider';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { Row } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/Progress';
import { Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useToast } from '../../components/ui/Toast';
import { blockMessage, formatBytes } from '../../domain/ai/download-check';
import { aiFailureMessage } from '../../domain/ai/errors';
import { LLM_FEATURES, type AiFeature } from '../../domain/ai/features';
import type { ModelEntry } from '../../domain/ai/manifest';
import type { Tier } from '../../domain/ai/tiers';
import { useApp } from '../app/AppContext';
import { logError } from '../app/log';
import { cancel, download, isInstalled, pause, remove, type DownloadOutcome } from './ai-pack-controller';
import { askText } from './ask';
import { useAiJob } from './useAiJob';
import { useAiPack } from './useAiPack';

const PRIVACY_NOTE = 'Runs on your phone. Your writing and recordings never leave the device. AI suggestions can be wrong.';

const TIER_TEXT: Record<Tier, string> = {
  high: 'This phone can run speech recognition and the larger language model.',
  mid: 'This phone can run speech recognition and the smaller language model.',
  low: 'This phone can run speech recognition. Language-model features need about 6 GB of memory, so they stay hidden.',
};

function outcomeToast(outcome: DownloadOutcome): { tone: 'success' | 'info' | 'error'; title: string; message?: string } | null {
  switch (outcome.kind) {
    case 'installed':
      return { tone: 'success', title: 'AI pack installed', message: 'It now works without internet.' };
    case 'blocked':
      return { tone: 'info', title: 'Download not started', message: blockMessage(outcome.block) };
    case 'checksum-failed':
      return { tone: 'error', title: 'Download damaged', message: `${outcome.modelName} didn't match its checksum, so it was deleted. Please try again.` };
    case 'failed':
      return {
        tone: 'error',
        title: 'Download stopped',
        message: `${outcome.modelName} couldn't finish downloading. Check your connection, then tap Download to try again.`,
      };
    case 'paused':
    case 'cancelled':
      return null;
  }
}

const FEATURE_TEXT: Record<AiFeature, { label: string; description: string }> = {
  speaking: { label: 'Speaking transcripts', description: 'Shows what the AI heard in your shadowing and speaking recordings.' },
  writing: { label: 'Writing feedback', description: 'Suggestions on your texts after you check them.' },
  explain: { label: 'Explain my mistake', description: 'A short explanation of a wrong answer in your mistakes.' },
  conversation: { label: 'Conversation partner', description: 'Practise speaking tasks 2 and 3 with an AI partner.' },
  generatedPractice: { label: 'AI-made practice (experimental)', description: 'Extra example sentences written by the AI. Off by default: they can contain errors.' },
};
const FEATURE_ORDER: readonly AiFeature[] = ['speaking', 'writing', 'explain', 'conversation', 'generatedPractice'];

/** A one-sentence request to check the language model runs on this phone, and how fast. */
function LlmCheck({ model }: { model: ModelEntry }) {
  const job = useAiJob<{ text: string; seconds: number }>('AI pack check');
  const check = () =>
    job.run(async (signal, onText) => {
      const started = Date.now();
      const text = await askText(
        {
          model,
          messages: [
            { role: 'system', content: 'Tu es un professeur de français. Réponds en une seule phrase courte, en français.' },
            { role: 'user', content: 'Dis bonjour à un apprenant qui prépare le TCF Canada.' },
          ],
          maxTokens: 48,
          temperature: 0.3,
          signal,
          onText,
        },
        { language: 'fr', maxChars: 300 },
      );
      return { text, seconds: Math.max(1, Math.round((Date.now() - started) / 1000)) };
    });
  const { state } = job;
  return (
    <View style={styles.model}>
      <Button
        label={state.status === 'working' ? 'Stop' : 'Test the language model'}
        icon={state.status === 'working' ? 'square' : 'cpu'}
        variant="secondary"
        onPress={state.status === 'working' ? job.cancel : check}
        testID="ai-llm-check"
      />
      {state.status === 'working' ? (
        <AppText variant="meta" tone="muted">
          {state.partial || 'Loading the model… the first answer takes longest.'}
        </AppText>
      ) : state.status === 'done' ? (
        <AppText variant="body" tone="secondary" testID="ai-llm-check-result">{`“${state.value.text}” (${state.value.seconds} s)`}</AppText>
      ) : state.status === 'failed' ? (
        <AppText variant="meta" tone="danger">
          {aiFailureMessage(state.failure)}
        </AppText>
      ) : null}
    </View>
  );
}

function ModelRow({ model, status }: { model: ModelEntry; status: string }) {
  return (
    <View style={styles.model} accessible accessibilityLabel={`${model.name}, ${formatBytes(model.bytes)}, ${status}`}>
      <Row gap={spacing.sm}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {model.name}
        </AppText>
        <AppText variant="meta" tone="muted">
          {formatBytes(model.bytes)}
        </AppText>
      </Row>
      <AppText variant="meta" tone="secondary">
        {status}
      </AppText>
    </View>
  );
}

export default function AiPackScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { settings, updateSetting } = useApp();
  const pack = useAiPack();
  const installed = isInstalled(pack);
  const missingBytes = pack.plan.models.filter((m) => !pack.installedIds.includes(m.id)).reduce((n, m) => n + m.bytes, 0);

  const statusOf = (model: ModelEntry): string => {
    if (pack.installedIds.includes(model.id)) return 'Installed';
    if (pack.active?.modelId === model.id) return `Downloading… ${Math.round(pack.active.fraction * 100)}%`;
    if (pack.pendingId === model.id) return 'Paused';
    return 'Not downloaded';
  };

  const start = async () => {
    try {
      const shown = outcomeToast(await download(settings.aiMobileData));
      if (shown) toast.show(shown);
    } catch (e: unknown) {
      logError('AI pack download', e);
      toast.show({ tone: 'error', title: 'Download stopped', message: 'Something went wrong. Please try again.' });
    }
  };

  const confirmDelete = async () => {
    const ok = await toast.confirm({
      title: 'Delete the AI pack?',
      message: `This frees ${formatBytes(pack.plan.models.reduce((n, m) => n + m.bytes, 0))}. The app goes back to working without AI; you can download it again later.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove();
      toast.show({ tone: 'success', title: 'AI pack deleted' });
    } catch {
      toast.show({ tone: 'error', title: "The AI pack couldn't be deleted", message: 'Please try again.' });
    }
  };

  return (
    <Screen testID="ai-pack-screen">
      <ScreenHeader title="AI pack" back />
      <View style={[styles.note, { backgroundColor: colors.skills.vocabulary.tint }]} accessible accessibilityRole="text">
        <Feather name="shield" size={20} color={colors.skills.vocabulary.onTint} />
        <AppText variant="bodyStrong" color={colors.skills.vocabulary.onTint} style={styles.flex}>
          {PRIVACY_NOTE}
        </AppText>
      </View>

      <Card>
        <SettingsGroup title="This phone">
          <AppText variant="body" tone="secondary">
            Optional. The AI pack adds feedback that runs on the phone after a one-time download. Everything else in the app works without it.
          </AppText>
          <AppText variant="body" testID="ai-tier">
            {TIER_TEXT[pack.plan.tier]}
          </AppText>
          {pack.plan.models.map((m) => (
            <ModelRow key={m.id} model={m} status={statusOf(m)} />
          ))}
          {pack.active ? <ProgressBar value={pack.active.fraction} accessibilityLabel="Download progress" /> : null}

          {pack.active ? (
            <Row gap={spacing.sm}>
              <Button label="Pause" icon="pause" variant="secondary" onPress={pause} style={styles.flex} testID="ai-pause" />
              <Button label="Cancel" variant="ghost" onPress={() => void cancel()} testID="ai-cancel" />
            </Row>
          ) : !installed ? (
            <Row gap={spacing.sm}>
              <Button
                label={pack.pendingId ? 'Resume download' : `Download (${formatBytes(missingBytes)})`}
                icon="download"
                onPress={() => void start()}
                style={styles.flex}
                testID="ai-download"
              />
              {pack.pendingId ? <Button label="Cancel" variant="ghost" onPress={() => void cancel()} testID="ai-cancel" /> : null}
            </Row>
          ) : null}
          {!installed ? (
            <SwitchRow
              label="Allow mobile data"
              description="Off: the download waits for Wi-Fi."
              value={settings.aiMobileData}
              onChange={(v) => void updateSetting('aiMobileData', v)}
              testID="ai-mobile-data"
            />
          ) : null}
          {installed || pack.installedIds.length > 0 ? (
            <Button label="Delete AI pack" icon="trash-2" variant="ghost" onPress={() => void confirmDelete()} testID="ai-delete" />
          ) : null}
        </SettingsGroup>
      </Card>

      {installed ? (
        <Card>
          <SettingsGroup title="Features">
            {FEATURE_ORDER.filter((f) => pack.plan.llm !== null || !LLM_FEATURES.includes(f)).map((f) => (
              <SwitchRow
                key={f}
                label={FEATURE_TEXT[f].label}
                description={FEATURE_TEXT[f].description}
                value={settings.aiFeatures[f]}
                onChange={(v) => void updateSetting('aiFeatures', { ...settings.aiFeatures, [f]: v })}
                testID={`ai-feature-${f}`}
              />
            ))}
            {pack.plan.llm ? <LlmCheck model={pack.plan.llm} /> : null}
          </SettingsGroup>
        </Card>
      ) : null}

      <Card>
        <SettingsGroup title="Models and licences">
          {pack.plan.models.map((m) => (
            <AppText key={m.id} variant="meta" tone="secondary">
              {m.name}: {m.source}. Licence: {m.licence}.
            </AppText>
          ))}
        </SettingsGroup>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: 16, alignItems: 'flex-start' },
  model: { gap: spacing.xs },
});
