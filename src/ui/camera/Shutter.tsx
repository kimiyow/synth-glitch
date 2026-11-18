import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";

import { tapFeedback } from "../../platform/haptics";

import { colors } from "../tokens";

export const SHUTTER_SIZE = 72;
// umbral entre toque (foto) y pulsación (clip)
export const HOLD_THRESHOLD_MS = 250;
const RING = 3;
const PROGRESS = 3;
const DOT = SHUTTER_SIZE - 18;
const SQUARE = 28;

type Props = {
  recording: boolean;
  disabled: boolean;
  // 0 → 1 durante los 5 s del clip
  progress: SharedValue<number>;
  onTap: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
};

// obturador de anillo: toque = foto; mantener > 250 ms = clip con anillo de progreso. Al pulsar se
// encoge; al grabar el punto se vuelve un cuadrado redondeado
export function Shutter({ recording, disabled, progress, onTap, onHoldStart, onHoldEnd }: Props) {
  const pressed = useSharedValue(0);
  // con "Reducir movimiento" el obturador no se encoge ni rebota: cambia de forma al instante
  const reduced = useReducedMotion();
  const innerStyle = useAnimatedStyle(() => {
    const size = recording ? SQUARE : DOT;
    return {
      width: (reduced ? size : withTiming(size, { duration: 180 })),
      height: (reduced ? size : withTiming(size, { duration: 180 })),
      borderRadius: (reduced ? (recording ? 7 : DOT / 2) : withTiming(recording ? 7 : DOT / 2, { duration: 180 })),
      transform: [{ scale: reduced ? 1 : withSpring(pressed.get() ? 0.88 : 1, { damping: 15, stiffness: 300 }) }],
    };
  });

  const r = SHUTTER_SIZE / 2 - PROGRESS / 2;
  const circle = Skia.PathBuilder.Make()
    .addArc({ x: PROGRESS / 2, y: PROGRESS / 2, width: r * 2, height: r * 2 }, -90, 359.9)
    .detach();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Obturador. Toca para foto, mantén para grabar un clip"
      disabled={disabled}
      delayLongPress={HOLD_THRESHOLD_MS}
      onPressIn={() => pressed.set(1)}
      onPress={() => {
        tapFeedback();
        onTap();
      }}
      onLongPress={() => {
        tapFeedback();
        onHoldStart();
      }}
      onPressOut={() => {
        pressed.set(0);
        onHoldEnd();
      }}
      style={[styles.root, disabled && styles.disabled]}
    >
      <Animated.View style={styles.ring} />
      <Animated.View style={[styles.inner, innerStyle]} />
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          path={circle}
          style="stroke"
          strokeWidth={PROGRESS}
          strokeCap="butt"
          color={colors.inkText}
          start={0}
          end={progress}
        />
      </Canvas>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },
  ring: {
    position: "absolute",
    width: SHUTTER_SIZE - PROGRESS * 2,
    height: SHUTTER_SIZE - PROGRESS * 2,
    borderRadius: SHUTTER_SIZE,
    borderWidth: RING,
    borderColor: colors.inkText,
  },
  inner: { backgroundColor: colors.inkText },
});
