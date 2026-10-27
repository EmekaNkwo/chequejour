import { StyleSheet, View } from 'react-native';
import { heardMatch } from '../../features/speech/offline-french';
import { useFrenchSpeech } from '../../features/speech/useFrenchSpeech';
import { useOfflineFrench } from '../../features/speech/useOfflineFrench';
import { FrenchSpeechSetup } from './FrenchSpeechSetup';
import { DictationDiff } from '../exercises/DictationDiff';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToast } from '../ui/Toast';

/**
 * Optional "what did the phone hear?" check using on-device recognition only. Hidden
 * on phones that can't guarantee on-device recognition; explains how to add French
 * when only the language pack is missing.
 */
export function OfflineCheck({ line, disabled }: { line: string; disabled: boolean }) {
  const speech = useOfflineFrench();
  const french = useFrenchSpeech();
  const toast = useToast();
  const { status } = speech;
  if (!status || status.status === 'unsupported') return null;

  if (status.status === 'needs-pack') return <FrenchSpeechSetup speech={french} purpose="Check what you said." />;

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
