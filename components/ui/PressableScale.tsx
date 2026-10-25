import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Scale while pressed; 1 disables the effect. */
  pressedScale?: number;
}

/** A pressable that shrinks slightly while pressed (skipped with reduce motion). */
export function PressableScale({ style, children, pressedScale = 0.97, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={(e) => {
        if (!reduceMotion) scale.set(withTiming(pressedScale, { duration: 90 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: 140 }));
        onPressOut?.(e);
      }}
      style={[style, animated]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
