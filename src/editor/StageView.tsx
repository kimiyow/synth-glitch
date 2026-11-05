import { StatusBar } from "expo-status-bar";
import { useState, type ComponentProps } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useStageScreen } from "../platform/screen";
import { colors } from "../ui/tokens";
import { EditorCanvas } from "./EditorCanvas";

/** 3.12: interactivo = el gesto X/Y del efecto seleccionado sigue activo; bloqueado = se ignora todo. */
export type StageMode = "interactive" | "locked";

/** Mantener pulsado este tiempo el punto de salida. */
export const STAGE_EXIT_HOLD_MS = 2000;
const EXIT_SIZE = 64;
const RING = 30;

type CanvasProps = Omit<ComponentProps<typeof EditorCanvas>, "brush" | "extraGesture" | "onCommitStroke" | "showSizePreview">;

/**
 * Modo escenario (STG-01, 3.12): el lienzo a pantalla completa, sin barras ni paneles ni
 * barra de estado; pantalla encendida y brillo al máximo (se restaura al salir). Para salir
 * se mantiene 2 s el punto de la esquina superior izquierda; doble toque con dos dedos
 * alterna el blackout (la salida se detiene sin cerrar el modo).
 */
export function StageView({ mode, canvas, onExit }: { mode: StageMode; canvas: CanvasProps; onExit: () => void }) {
  useStageScreen();
  const insets = useSafeAreaInsets();
  const [blackout, setBlackout] = useState(false);
  const toggleBlackout = () => setBlackout((b) => !b);

  const blackoutTap = Gesture.Tap()
    .numberOfTaps(2)
    .minPointers(2)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) toggleBlackout();
    });

  // Anillo de salida: se llena mientras se mantiene pulsado; al soltar antes, se vacía.
  const progress = useSharedValue(0);
  const exitHold = Gesture.LongPress()
    .minDuration(STAGE_EXIT_HOLD_MS)
    .maxDistance(EXIT_SIZE)
    .onBegin(() => {
      progress.set(withTiming(1, { duration: STAGE_EXIT_HOLD_MS, easing: Easing.linear }));
    })
    .onFinalize(() => {
      cancelAnimation(progress);
      progress.set(withTiming(0, { duration: 150 }));
    });
  const exitCommit = Gesture.LongPress()
    .minDuration(STAGE_EXIT_HOLD_MS)
    .maxDistance(EXIT_SIZE)
    .runOnJS(true)
    .onStart(() => onExit());
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: progress.get() > 0 ? colors.inkText : colors.inkLine,
    transform: [{ scale: 1 + progress.get() * 0.25 }],
    opacity: 0.35 + progress.get() * 0.65,
  }));

  // Bloqueado (o en blackout): una capa encima recibe todo y solo reconoce el blackout.
  const shield = mode === "locked" || blackout;

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" supportedOrientations={["portrait"]}>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar hidden />
        {!blackout && (
          <EditorCanvas
            {...canvas}
            brush={null}
            xyLayerId={mode === "interactive" ? canvas.xyLayerId : null}
            extraGesture={mode === "interactive" ? blackoutTap : undefined}
          />
        )}
        {shield && (
          <GestureDetector gesture={blackoutTap}>
            <View style={StyleSheet.absoluteFill} accessibilityLabel="Modo escenario bloqueado" />
          </GestureDetector>
        )}
        <GestureDetector gesture={Gesture.Simultaneous(exitHold, exitCommit)}>
          <View style={[styles.exit, { top: insets.top, left: insets.left }]} accessibilityRole="button" accessibilityLabel="Salir del modo escenario: mantén pulsado 2 segundos">
            <Animated.View style={[styles.ring, ringStyle]} />
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  exit: { position: "absolute", top: 0, left: 0, width: EXIT_SIZE, height: EXIT_SIZE, alignItems: "center", justifyContent: "center" },
  ring: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2 },
});
