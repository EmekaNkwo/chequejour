/**
 * Background task the launcher runs when the widget is added, resized or due for its
 * periodic update. It only reads the app's local database.
 */
import * as SQLite from 'expo-sqlite';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { toDayKey } from '../domain/dates';
import { DATABASE_NAME } from '../features/app/bootstrap';
import { logError } from '../features/app/log';
import { loadWidgetWord, type WidgetWordView } from '../features/widget/widget-data';
import { WORD_WIDGET_NAME, wordWidget } from './WordOfDayWidget';

export async function currentWidgetWord(): Promise<WidgetWordView | null> {
  try {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    return await loadWidgetWord(db, toDayKey(new Date()));
  } catch (e: unknown) {
    logError('widget word', e);
    return null;
  }
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetInfo.widgetName !== WORD_WIDGET_NAME) return;
  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_RESIZED') {
    renderWidget(wordWidget(await currentWidgetWord(), widgetInfo));
  }
}
