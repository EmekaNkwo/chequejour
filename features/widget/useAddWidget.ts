import Constants from 'expo-constants';
import { AppState, Linking, Platform } from 'react-native';
import { getWidgetInfo, requestPinWidget } from 'react-native-android-widget';
import { useToast } from '../../components/ui/Toast';
import { WORD_WIDGET_NAME } from '../../widget/WordOfDayWidget';
import { logError } from '../app/log';
import { addWidgetOutcome, isXiaomi } from './widget-pin';

/** How long the app waits for the launcher's prompt to take over the screen. */
const PROMPT_WAIT_MS = 2500;
/** Upper bound on waiting for the learner to answer the prompt. */
const MAX_WAIT_MS = 120_000;
/** Lets the launcher register a just-added widget before it is counted. */
const SETTLE_MS = 800;
/** Back this fast means no prompt was really shown. */
const QUICK_RETURN_MS = 1500;
const MANUAL = 'Long-press an empty spot on the home screen, choose Widgets, then Chaque Jour › Mot du jour.';

/**
 * Resolves 'returned' once a launcher prompt took over the screen and the learner came
 * back from it. 'stayed' when nothing took over, or only for a moment: MIUI opens its
 * add-widget screen and closes it within ~100 ms when the permission is off, far faster
 * than anyone could answer a prompt.
 */
function waitForPrompt(): Promise<'stayed' | 'returned'> {
  return new Promise((resolve) => {
    let leftAt: number | null = null;
    const finish = (result: 'stayed' | 'returned') => {
      sub.remove();
      clearTimeout(stayTimer);
      clearTimeout(maxTimer);
      setTimeout(() => resolve(result), SETTLE_MS);
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') leftAt ??= Date.now();
      else if (leftAt !== null) finish(Date.now() - leftAt < QUICK_RETURN_MS ? 'stayed' : 'returned');
    });
    const stayTimer = setTimeout(() => {
      if (leftAt === null) finish('stayed');
    }, PROMPT_WAIT_MS);
    const maxTimer = setTimeout(() => finish(leftAt === null ? 'stayed' : 'returned'), MAX_WAIT_MS);
  });
}

/** MIUI's own permission screen for this app, falling back to the app's info page. */
async function openPermissionSettings(): Promise<void> {
  const pkg = Constants.expoConfig?.android?.package;
  try {
    if (!pkg) throw new Error('no package name');
    await Linking.sendIntent('miui.intent.action.APP_PERM_EDITOR', [{ key: 'extra_pkgname', value: pkg }]);
  } catch {
    await Linking.openSettings();
  }
}

export function useAddWidget(): () => Promise<void> {
  const toast = useToast();
  return async () => {
    try {
      const outcome = await addWidgetOutcome({
        request: () => requestPinWidget({ widgetName: WORD_WIDGET_NAME }),
        count: async () => (await getWidgetInfo(WORD_WIDGET_NAME)).length,
        waitForPrompt,
      });
      if (outcome === 'added') toast.show({ tone: 'success', title: 'Widget added', message: 'Mot du jour is on your home screen.' });
      else if (outcome === 'no-prompt' && isXiaomi(Platform.constants as { Manufacturer?: string; Brand?: string })) {
        toast.show({
          tone: 'info',
          title: 'Allow home screen shortcuts',
          message: `Xiaomi phones block apps from adding widgets until you turn on "Home screen shortcuts" for Chaque Jour (Other permissions), then tap Add the widget again. Or: ${MANUAL}`,
          actions: [{ label: 'Open settings', onPress: () => void openPermissionSettings().catch((e: unknown) => logError('open settings', e)) }, { label: 'Not now' }],
        });
      } else if (outcome === 'no-prompt' || outcome === 'unsupported') {
        toast.show({ tone: 'info', title: 'Add it from your home screen', message: MANUAL });
      }
    } catch (e: unknown) {
      logError('pin widget', e);
      toast.show({ tone: 'info', title: 'Add it from your home screen', message: MANUAL });
    }
  };
}
