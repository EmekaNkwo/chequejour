import { useEffect } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';
import { loadWidgetWord } from '../features/widget/widget-data';
import { WORD_WIDGET_NAME, wordWidget } from './WordOfDayWidget';

/** Redraws the home-screen widget when the day changes or daily items are reassigned. */
export function WidgetUpdater() {
  const { db, today, dataVersion } = useApp();
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    loadWidgetWord(db, today)
      .then((word) => requestWidgetUpdate({ widgetName: WORD_WIDGET_NAME, renderWidget: () => wordWidget(word) }))
      .catch((e: unknown) => logError('widget update', e));
  }, [db, today, dataVersion]);
  return null;
}
