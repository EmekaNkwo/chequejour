import { useColorScheme } from 'react-native';
import { WidgetPreview } from 'react-native-android-widget';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { loadWidgetDaily } from '../../features/widget/widget-data';
import { dailyWidget } from '../../widget/WordOfDayWidget';

const PREVIEW_SIZE = { width: 300, height: 220 };

/** Live preview of the home-screen widget, in the phone's current light or dark mode. */
export function WidgetPreviewCard() {
  const { db, today } = useApp();
  const scheme = useColorScheme();
  const { data, loading } = useLoad('widget preview', () => loadWidgetDaily(db, today), [today]);
  if (loading) return null;
  const widget = dailyWidget(data ?? [], PREVIEW_SIZE);
  return <WidgetPreview renderWidget={() => (scheme === 'dark' ? widget.dark : widget.light)} width={PREVIEW_SIZE.width} height={PREVIEW_SIZE.height} />;
}
