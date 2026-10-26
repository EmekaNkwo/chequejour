import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widget/task-handler';
import 'expo-router/entry';

registerWidgetTaskHandler(widgetTaskHandler);
