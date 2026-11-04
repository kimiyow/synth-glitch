import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { Pressable, StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { colors } from "../tokens";

export const SHUTTER_SIZE = 72;
/** Umbral entre toque (foto) y pulsación (clip), SDD 3.10. */
export const HOLD_THRESHOLD_MS = 250;
const RING = 2;
const PROGRESS = 3;

type Props = {
  recording: boolean;
  disabled: boolean;
  /** 0 → 1 durante los 5 s del clip. */
  progress: SharedValue<number>;
  onTap: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
};

/** Obturador de anillo: toque = foto; mantener > 250 ms = clip con anillo de progreso. */
export function Shutter({ recording, disabled, progress, onTap, onHoldStart, onHoldEnd }: Props) {
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
      onPress={onTap}
      onLongPress={onHoldStart}
      onPressOut={onHoldEnd}
      style={[styles.root, disabled && styles.disabled]}
    >
      <View style={styles.ring} />
      <View style={recording ? styles.square : styles.dot} />
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
  dot: {
    width: SHUTTER_SIZE - 20,
    height: SHUTTER_SIZE - 20,
    borderRadius: SHUTTER_SIZE,
    backgroundColor: colors.inkText,
  },
  square: { width: 26, height: 26, backgroundColor: colors.inkText },
});
