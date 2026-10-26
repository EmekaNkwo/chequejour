'use no memo';
// The widget renderer walks plain function components, so keep the React Compiler off here.

import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { darkColors, lightColors, type ThemeColors } from '../components/theme/tokens';
import type { WidgetWordView } from '../features/widget/widget-data';
import { WIDGET_BASE_SIZE, widgetLayout, type WidgetLayout, type WidgetSize } from '../features/widget/widget-layout';

export const WORD_WIDGET_NAME = 'WordOfDay';

/** Must be #RRGGBB: the widget renderer doesn't accept other colour formats. */
const hex = (c: string): `#${string}` => c as `#${string}`;

function WordOfDay({ word, colors, layout: l }: { word: WidgetWordView | null; colors: ThemeColors; layout: WidgetLayout }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: word?.url ?? 'chequejour://' }}
      accessibilityLabel={word ? `Word of the day: ${word.fr}, ${word.detail}, ${word.en}. Opens Chaque Jour.` : 'Open Chaque Jour'}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: hex(colors.surface), borderRadius: 22, padding: l.padding, justifyContent: 'center' }}
    >
      <TextWidget text="MOT DU JOUR" style={{ fontSize: l.label, fontWeight: 'bold', color: hex(colors.primary), letterSpacing: 0.08 }} />
      {/* No fragments here: the widget renderer only accepts widget elements. */}
      {word ? <TextWidget text={word.fr} maxLines={1} truncate="END" style={{ fontSize: l.word, fontWeight: 'bold', color: hex(colors.text), marginTop: l.gap }} /> : null}
      {word ? <TextWidget text={word.detail} maxLines={1} style={{ fontSize: l.detail, color: hex(colors.textMuted), marginTop: Math.round(l.gap / 2) }} /> : null}
      <TextWidget
        text={word ? word.en : 'Open Chaque Jour to get your word of the day.'}
        maxLines={word ? l.englishLines : l.englishLines + 1}
        truncate="END"
        style={{ fontSize: l.english, color: hex(colors.textSecondary), marginTop: Math.round(l.gap * 1.5) }}
      />
    </FlexWidget>
  );
}

/**
 * Light and dark versions; the launcher picks the one matching the phone's theme. Text
 * scales with the size the launcher reports, so a stretched widget isn't mostly empty.
 */
export function wordWidget(word: WidgetWordView | null, size: WidgetSize = WIDGET_BASE_SIZE) {
  const layout = widgetLayout(size, word?.fr);
  return { light: <WordOfDay word={word} colors={lightColors} layout={layout} />, dark: <WordOfDay word={word} colors={darkColors} layout={layout} /> };
}
