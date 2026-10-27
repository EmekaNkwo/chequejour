import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import type { FrenchSpeech } from '../../features/speech/useFrenchSpeech';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { LinkText, Row } from '../ui/Bits';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const INSTALL_STEPS = [
  'Open your phone’s Settings and search for “on-device speech recognition” (on some phones: Google app › Settings › Voice › Offline speech recognition).',
  'Add French (France or Canada) and wait for it to download.',
  'Come back here: it is picked up once French is installed.',
];

/**
 * Shown when the phone could recognise French offline but its French speech pack is
 * missing. On Android the app can ask the phone to fetch it; elsewhere it explains how.
 */
export function FrenchSpeechSetup({ speech, purpose }: { speech: FrenchSpeech; purpose: string }) {
  const { colors } = useTheme();
  const [showSteps, setShowSteps] = useState(false);
  const [asked, setAsked] = useState(false);
  if (speech.status?.status !== 'needs-pack') return null;
  const install = () => {
    setAsked(true);
    void speech.install();
  };
  return (
    <Card testID="french-speech-setup">
      <Row gap={spacing.sm}>
        <Feather name="wifi-off" size={16} color={colors.textMuted} />
        <AppText variant="bodyStrong" style={styles.flex}>
          Add French speech recognition
        </AppText>
      </Row>
      <AppText variant="meta" tone="muted">
        {`${purpose} Your phone does this offline once its French speech pack is installed. Chaque Jour never uses online recognition.`}
      </AppText>
      {speech.canInstall ? (
        <Button label={asked ? 'Downloading… ask again' : 'Download French'} icon="download" variant="secondary" onPress={install} testID="french-speech-install" />
      ) : null}
      {asked ? (
        <AppText variant="meta" tone="muted">
          Your phone downloads it in the background, sometimes only on Wi-Fi. It is used here as soon as it is ready.
        </AppText>
      ) : null}
      {showSteps ? (
        INSTALL_STEPS.map((s, i) => <AppText key={s} variant="body" tone="secondary">{`${i + 1}. ${s}`}</AppText>)
      ) : (
        <LinkText label={speech.canInstall ? 'Or install it from Settings' : 'How to install French'} onPress={() => setShowSteps(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
