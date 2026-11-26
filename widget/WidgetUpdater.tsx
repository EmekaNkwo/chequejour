import { useEffect } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';
import { loadWidgetDaily } from '../features/widget/widget-data';
import { dailyWidget, WORD_WIDGET_NAME } from './WordOfDayWidget';

/** Redraws the home-screen widget when the day changes or daily items are reassigned. */
export function WidgetUpdater() {
  const { db, today, dataVersion } = useApp();
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    loadWidgetDaily(db, today)
      .then((items) => requestWidgetUpdate({ widgetName: WORD_WIDGET_NAME, renderWidget: (info) => dailyWidget(items, info) }))
      .catch((e: unknown) => logError('widget update', e));
  }, [db, today, dataVersion]);
  return null;
}
