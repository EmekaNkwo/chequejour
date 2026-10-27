/**
 * In-app toasts: answer feedback, confirmations and errors. One toast shows at a
 * time at the top of the screen; a new one replaces it. Replaces the system Alert.
 */
import { Feather } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toastDuration, type ToastOptions, type ToastTone } from '../../domain/toast';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface ToastApi {
  /** Returns an id for dismissing this toast later. */
  show: (options: ToastOptions) => number;
  /** Without an id, closes whatever is showing; with one, only that toast. */
  dismiss: (id?: number) => void;
  /** Asks a yes/no question in a toast; resolves false if it is dismissed or replaced. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface ActiveToast {
  id: number;
  options: ToastOptions;
  /** Settles a pending confirm when the toast goes away without an answer. */
  onClose?: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const nextId = useRef(1);
  const current = useRef<ActiveToast | null>(null);

  const replace = useCallback((next: ActiveToast | null) => {
    const previous = current.current;
    current.current = next;
    setToast(next);
    previous?.onClose?.();
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      replace({ id, options });
      AccessibilityInfo.announceForAccessibility([options.title, options.detail, options.message].filter(Boolean).join('. '));
      return id;
    },
    [replace],
  );

  const dismiss = useCallback(
    (id?: number) => {
      if (id === undefined || current.current?.id === id) replace(null);
    },
    [replace],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const id = nextId.current++;
        replace({
          id,
          onClose: () => settle(false),
          options: {
            tone: options.destructive ? 'error' : 'info',
            title: options.title,
            message: options.message,
            actions: [
              { label: options.cancelLabel ?? 'Cancel', onPress: () => settle(false) },
              { label: options.confirmLabel, destructive: options.destructive, onPress: () => settle(true) },
            ],
          },
        });
        AccessibilityInfo.announceForAccessibility([options.title, options.message].filter(Boolean).join('. '));
      }),
    [replace],
  );

  const api = useMemo(() => ({ show, dismiss, confirm }), [show, dismiss, confirm]);

  // A toast that waits for an answer belongs to the screen that asked; close it when
  // the learner navigates away (back gesture, tab press) so its buttons can't act on another screen.
  const pathname = usePathname();
  useEffect(() => {
    const active = current.current;
    if (active && toastDuration(active.options) === null) replace(null);
  }, [pathname, replace]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDismiss={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

const ICONS: Record<ToastTone, 'check-circle' | 'x-circle' | 'alert-triangle' | 'info'> = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-triangle',
  info: 'info',
};

function useToneColors(tone: ToastTone): { fg: string; bg: string } {
  const { colors } = useTheme();
  switch (tone) {
    case 'success':
      return { fg: colors.success, bg: colors.successTint };
    case 'error':
      return { fg: colors.danger, bg: colors.dangerTint };
    case 'warning':
      return { fg: colors.skills.vocabulary.onTint, bg: colors.skills.vocabulary.tint };
    default:
      return { fg: colors.skills.listening.onTint, bg: colors.skills.listening.tint };
  }
}

function ToastView({ toast, onDismiss: dismissById }: { toast: ActiveToast; onDismiss: (id: number) => void }) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { options } = toast;
  const tone = useToneColors(options.tone);
  const duration = toastDuration(options);
  const { id } = toast;
  const onDismiss = useCallback(() => dismissById(id), [dismissById, id]);

  useEffect(() => {
    if (duration === null) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  const actions = options.actions ?? [];
  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + spacing.sm }]}>
      <Animated.View
        entering={reduceMotion ? FadeIn.duration(150) : SlideInUp.duration(260)}
        exiting={reduceMotion ? FadeOut.duration(120) : SlideOutUp.duration(200)}
        style={[styles.toast, shadow, { backgroundColor: colors.surface, borderColor: tone.bg }]}
        testID={`toast-${options.tone}`}
      >
        <Pressable onPress={actions.length === 0 ? onDismiss : undefined} accessible={false} style={styles.row}>
          <View style={[styles.icon, { backgroundColor: tone.bg }]}>
            <Feather name={ICONS[options.tone]} size={20} color={tone.fg} />
          </View>
          <View style={styles.body}>
            <AppText variant="cardTitle" color={tone.fg} accessibilityRole="header">
              {options.title}
            </AppText>
            {options.detail ? (
              <AppText variant="french" french>
                {options.detail}
              </AppText>
            ) : null}
            {options.message ? (
              <AppText variant="body" tone="secondary">
                {options.message}
              </AppText>
            ) : null}
          </View>
          {actions.length === 0 ? (
            <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss" testID="toast-dismiss">
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Pressable>
        {actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map((a) => (
              <Button
                key={a.label}
                label={a.label}
                variant={a.destructive ? 'primary' : 'secondary'}
                onPress={() => {
                  a.onPress?.();
                  onDismiss();
                }}
                style={styles.action}
                testID={`toast-action-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
              />
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 1000, elevation: 1000 },
  toast: { borderRadius: radii.lg, borderWidth: 2, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
