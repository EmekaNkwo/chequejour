'use no memo';
// The widget renderer walks plain function components, so keep the React Compiler off here.

import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { darkColors, lightColors, type ThemeColors } from '../components/theme/tokens';
import type { WidgetItemView } from '../features/widget/widget-data';
import { playWordAction } from '../features/widget/widget-play';
import { WIDGET_BASE_SIZE, widgetLayout, type WidgetLayout, type WidgetSize } from '../features/widget/widget-layout';

/** Kept from when the widget only showed the word: renaming it would drop widgets already placed. */
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

interface Themed {
  colors: ThemeColors;
  layout: WidgetLayout;
}

/** Text opens the item; the speaker beside it (a sibling, not nested) plays it. */
function ItemRow({ item, colors, layout: l }: Themed & { item: WidgetItemView }) {
  const icon = Math.round(l.button * 0.5);
  return (
    <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: item.url }}
        accessibilityLabel={`${item.label.toLowerCase()}: ${item.fr}, ${item.sub}. Opens Chaque Jour.`}
        style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'center' }}
      >
        {l.compact ? null : <TextWidget text={item.label} style={{ fontSize: l.label, fontFamily: BOLD_FONT, color: hex(colors.primary), letterSpacing: 0.08 }} />}
        <TextWidget text={item.fr} maxLines={item.kind === 'sentence' ? l.frLines : 1} truncate="END" style={{ fontSize: l.fr, fontFamily: BOLD_FONT, color: hex(colors.text) }} />
        {l.compact ? null : <TextWidget text={item.sub} maxLines={l.subLines} truncate="END" style={{ fontSize: l.sub, color: hex(colors.textSecondary) }} />}
      </FlexWidget>
      <FlexWidget
        {...playWordAction(item)}
        accessibilityLabel={`Play ${item.fr}`}
        style={{ height: l.button, width: l.button, borderRadius: l.button / 2, marginLeft: l.gap * 2, backgroundColor: hex(colors.primary), justifyContent: 'center', alignItems: 'center' }}
      >
        <SvgWidget svg={speakerSvg(colors.onPrimary)} style={{ height: icon, width: icon }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function Divider({ colors, layout: l }: Themed) {
  return <FlexWidget style={{ height: 1, width: 'match_parent', marginVertical: l.gap, backgroundColor: hex(colors.border) }} />;
}

function DailyWidget({ items, colors, layout: l }: Themed & { items: readonly WidgetItemView[] }) {
  const card = { height: 'match_parent', width: 'match_parent', backgroundColor: hex(colors.surface), borderRadius: 22, padding: l.padding } as const;
  if (items.length === 0) {
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'chequejour://' }} accessibilityLabel="Open Chaque Jour" style={{ ...card, justifyContent: 'center', alignItems: 'center' }}>
        <TextWidget text="CHAQUE JOUR" style={{ fontSize: 11, fontFamily: BOLD_FONT, color: hex(colors.primary) }} />
        <TextWidget text="Open Chaque Jour to get today's word, sentence and verb." maxLines={3} style={{ textAlign: 'center', fontSize: 14, color: hex(colors.textSecondary), marginTop: 6 }} />
      </FlexWidget>
    );
  }
  // No fragments: the widget renderer only accepts widget elements, so rows and dividers are interleaved by hand.
  const children = items.flatMap((item, i) => [
    ...(i > 0 ? [<Divider key={`d${i}`} colors={colors} layout={l} />] : []),
    <ItemRow key={item.kind} item={item} colors={colors} layout={l} />,
  ]);
  return <FlexWidget style={{ ...card, flexDirection: 'column' }}>{children}</FlexWidget>;
}

/**
 * Light and dark versions; the launcher picks the one matching the phone's theme. Text
 * scales with the size the launcher reports, so a stretched widget isn't mostly empty.
 */
export function dailyWidget(items: readonly WidgetItemView[], size: WidgetSize = WIDGET_BASE_SIZE) {
  const layout = widgetLayout(size);
  return { light: <DailyWidget items={items} colors={lightColors} layout={layout} />, dark: <DailyWidget items={items} colors={darkColors} layout={layout} /> };
}
