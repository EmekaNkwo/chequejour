'use no memo';
// The widget renderer walks plain function components, so keep the React Compiler off here.

import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { darkColors, lightColors, type ThemeColors } from '../components/theme/tokens';
import type { WidgetWordView } from '../features/widget/widget-data';

export const WORD_WIDGET_NAME = 'WordOfDay';

/** Must be #RRGGBB: the widget renderer doesn't accept other colour formats. */
const hex = (c: string): `#${string}` => c as `#${string}`;

function WordOfDay({ word, colors }: { word: WidgetWordView | null; colors: ThemeColors }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: word?.url ?? 'chequejour://' }}
      accessibilityLabel={word ? `Word of the day: ${word.fr}, ${word.detail}, ${word.en}. Opens Chaque Jour.` : 'Open Chaque Jour'}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: hex(colors.surface), borderRadius: 22, padding: 16, justifyContent: 'center' }}
    >
      <TextWidget text="MOT DU JOUR" style={{ fontSize: 11, fontWeight: '700', color: hex(colors.primary), letterSpacing: 0.08 }} />
      {/* No fragments here: the widget renderer only accepts widget elements. */}
      {word ? <TextWidget text={word.fr} maxLines={1} truncate="END" style={{ fontSize: 24, fontWeight: '700', color: hex(colors.text), marginTop: 4 }} /> : null}
      {word ? <TextWidget text={word.detail} maxLines={1} style={{ fontSize: 13, color: hex(colors.textMuted), marginTop: 2 }} /> : null}
      <TextWidget
        text={word ? word.en : 'Open Chaque Jour to get your word of the day.'}
        maxLines={word ? 2 : 3}
        truncate="END"
        style={{ fontSize: 15, color: hex(colors.textSecondary), marginTop: 6 }}
      />
    </FlexWidget>
  );
}

/** Light and dark versions; the launcher picks the one matching the phone's theme. */
export function wordWidget(word: WidgetWordView | null) {
  return { light: <WordOfDay word={word} colors={lightColors} />, dark: <WordOfDay word={word} colors={darkColors} /> };
}
