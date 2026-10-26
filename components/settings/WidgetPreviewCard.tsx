import { useColorScheme } from 'react-native';
import { WidgetPreview } from 'react-native-android-widget';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { loadWidgetWord } from '../../features/widget/widget-data';
import { wordWidget } from '../../widget/WordOfDayWidget';

/** Live preview of the home-screen widget, in the phone's current light or dark mode. */
export function WidgetPreviewCard() {
  const { db, today } = useApp();
  const scheme = useColorScheme();
  const { data, loading } = useLoad('widget preview', () => loadWidgetWord(db, today), [today]);
  if (loading) return null;
  const widget = wordWidget(data);
  return <WidgetPreview renderWidget={() => (scheme === 'dark' ? widget.dark : widget.light)} width={300} height={150} />;
}
