import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { heardMatch } from '../../features/speech/offline-french';
import { useOfflineFrench } from '../../features/speech/useOfflineFrench';
import { DictationDiff } from '../exercises/DictationDiff';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { LinkText, Row } from '../ui/Bits';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToast } from '../ui/Toast';

const INSTALL_STEPS = [
  'Open your phone’s Settings and search for “on-device speech recognition” (on some phones: Google app › Settings › Voice › Offline speech recognition).',
  'Add French (France or Canada) and wait for it to download.',
  'Come back here: the check appears once French is installed.',
];

/**
 * Optional "what did the phone hear?" check using on-device recognition only. Hidden
 * on phones that can't guarantee on-device recognition; explains how to add French
 * when only the language pack is missing.
 */
export function OfflineCheck({ line, disabled }: { line: string; disabled: boolean }) {
  const speech = useOfflineFrench();
  const toast = useToast();
  const { colors } = useTheme();
  const [showSteps, setShowSteps] = useState(false);
  const { status } = speech;
  if (!status || status.status === 'unsupported') return null;

  if (status.status === 'needs-pack') {
    return (
      <Card testID="offline-check-setup">
        <Row gap={spacing.sm}>
          <Feather name="wifi-off" size={16} color={colors.textMuted} />
          <AppText variant="bodyStrong" style={styles.flex}>
            Check what you said, offline
          </AppText>
        </Row>
        <AppText variant="meta" tone="muted">
          Your phone can recognise French speech without the internet once its French speech pack is installed. Chaque Jour never uses online recognition.
        </AppText>
        {showSteps ? (
          INSTALL_STEPS.map((s, i) => <AppText key={s} variant="body" tone="secondary">{`${i + 1}. ${s}`}</AppText>)
        ) : (
          <LinkText label="How to install French" onPress={() => setShowSteps(true)} />
        )}
      </Card>
    );
  }

  const listen = async () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    const result = await speech.listen();
    if (result === 'no-permission') toast.show({ tone: 'warning', title: 'Microphone unavailable', message: 'Allow the microphone to check what you said.' });
  };
  const match = speech.heard !== null ? heardMatch(line, speech.heard) : null;

  return (
    <Card testID="offline-check">
      <Button
        label={speech.listening ? 'Listening… tap to stop' : '4. Say it, then check'}
        icon={speech.listening ? 'square' : 'check-circle'}
        variant="secondary"
        onPress={() => void listen()}
        disabled={disabled && !speech.listening}
        testID="offline-check-listen"
      />
      {speech.error ? (
        <AppText variant="meta" tone="danger">
          {speech.error}
        </AppText>
      ) : null}
      {match ? (
        <View style={styles.gap}>
          <AppText variant="bodyStrong">{`Your phone heard ${match.matched} of ${match.total} words`}</AppText>
          <DictationDiff expected={line} typed={speech.heard ?? ''} />
          <AppText variant="meta" tone="muted">
            {`Heard: “${speech.heard}”. Recognised on this phone only. This is a practice hint, not a pronunciation score.`}
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
});
