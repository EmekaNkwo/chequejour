'use no memo';
// The widget renderer walks plain function components, so keep the React Compiler off here.

import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { darkColors, lightColors, type ThemeColors } from '../components/theme/tokens';
import type { WidgetWordView } from '../features/widget/widget-data';
import { playWordAction } from '../features/widget/widget-play';
import { WIDGET_BASE_SIZE, widgetLayout, type WidgetLayout, type WidgetSize } from '../features/widget/widget-layout';

export const WORD_WIDGET_NAME = 'WordOfDay';

/** Must be #RRGGBB: the widget renderer doesn't accept other colour formats. */
const hex = (c: string): `#${string}` => c as `#${string}`;
/**
 * The app's bold font, embedded for the widget (app.json, expo-font). Asking the system
 * font for bold isn't enough: MIUI's default font ignores the weight.
 */
const BOLD_FONT = 'Nunito_700Bold';

/** Feather's volume-2 speaker, drawn in the button's text colour. */
const speakerSvg = (color: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;

function WordOfDay({ word, colors, layout: l }: { word: WidgetWordView | null; colors: ThemeColors; layout: WidgetLayout }) {
  if (!word) return <WordCard word={word} colors={colors} layout={l} />;
  const icon = Math.round(l.button * 0.5);
  return (
    <OverlapWidget style={{ height: 'match_parent', width: 'match_parent' }}>
      <WordCard word={word} colors={colors} layout={l} />
      {/* The button sits in the top-right corner, over the card; taps elsewhere open the word. */}
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', alignItems: 'flex-end', padding: l.buttonInset }}>
        <FlexWidget
          {...playWordAction(word)}
          accessibilityLabel={`Play the pronunciation of ${word.fr}`}
          style={{ height: l.button, width: l.button, borderRadius: l.button / 2, backgroundColor: hex(colors.primary), justifyContent: 'center', alignItems: 'center' }}
        >
          <SvgWidget svg={speakerSvg(colors.onPrimary)} style={{ height: icon, width: icon }} />
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}

function WordCard({ word, colors, layout: l }: { word: WidgetWordView | null; colors: ThemeColors; layout: WidgetLayout }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: word?.url ?? 'chequejour://' }}
      accessibilityLabel={word ? `Word of the day: ${word.fr}, ${word.detail}, ${word.en}. Opens Chaque Jour.` : 'Open Chaque Jour'}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: hex(colors.surface), borderRadius: 22, padding: l.padding, justifyContent: 'center', alignItems: 'center' }}
    >
      <TextWidget text="MOT DU JOUR" style={{ textAlign: 'center', fontSize: l.label, fontFamily: BOLD_FONT, color: hex(colors.primary), letterSpacing: 0.08 }} />
      {/* No fragments here: the widget renderer only accepts widget elements. */}
      {word ? <TextWidget text={word.fr} maxLines={1} truncate="END" style={{ textAlign: 'center', fontSize: l.word, fontFamily: BOLD_FONT, color: hex(colors.text), marginTop: l.gap }} /> : null}
      {word ? <TextWidget text={word.detail} maxLines={1} style={{ textAlign: 'center', fontSize: l.detail, color: hex(colors.textMuted), marginTop: Math.round(l.gap / 2) }} /> : null}
      <TextWidget
        text={word ? word.en : 'Open Chaque Jour to get your word of the day.'}
        maxLines={word ? l.englishLines : l.englishLines + 1}
        truncate="END"
        style={{ textAlign: 'center', fontSize: l.english, color: hex(colors.textSecondary), marginTop: Math.round(l.gap * 1.5) }}
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
