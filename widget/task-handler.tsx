/**
 * Background task the launcher runs when the widget is added, resized or due for its
 * periodic update. It only reads the app's local database.
 */
import * as SQLite from 'expo-sqlite';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { toDayKey } from '../domain/dates';
import { DATABASE_NAME } from '../features/app/bootstrap';
import { logError } from '../features/app/log';
import { play, stop, warmUp } from '../features/audio/audio-controller';
import { loadSettings } from '../data/settings-repo';
import { loadWidgetDaily, type WidgetItemView } from '../features/widget/widget-data';
import { playFromWidget } from '../features/widget/widget-play';
import { dailyWidget, WORD_WIDGET_NAME } from './WordOfDayWidget';

export async function currentWidgetItems(): Promise<WidgetItemView[]> {
  try {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    return await loadWidgetDaily(db, toDayKey(new Date()));
  } catch (e: unknown) {
    logError('widget items', e);
    return [];
  }
}

/** Plays a word, sentence or verb through the app's audio controller, at the learner's chosen speed. */
async function playWord(clickAction: string | undefined, data: Record<string, unknown> | undefined): Promise<void> {
  try {
    // Audio setup is the slow part of a tap; start it while the settings load.
    const warm = warmUp();
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const { playbackRate } = await loadSettings(db);
    await warm;
    await playFromWidget(clickAction, data, { play, stop }, playbackRate);
  } catch (e: unknown) {
    logError('widget play word', e);
  }
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetInfo.widgetName !== WORD_WIDGET_NAME) return;
  if (widgetAction === 'WIDGET_CLICK') {
    await playWord(clickAction, clickActionData);
    return;
  }
  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_RESIZED') {
    renderWidget(dailyWidget(await currentWidgetItems(), widgetInfo));
  }
}
