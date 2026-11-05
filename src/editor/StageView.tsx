import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ComponentProps } from "react";
import { Modal, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { DEV_TOOLS_ENABLED } from "../dev/devTools";
import { FULL_SCALE, stepRenderScale } from "../engine/renderScale";
import { useStageScreen } from "../platform/screen";
import { colors, type } from "../ui/tokens";
import { EditorCanvas } from "./EditorCanvas";

/** 3.12: interactivo = el gesto X/Y del efecto seleccionado sigue activo; bloqueado = se ignora todo. */
export type StageMode = "interactive" | "locked";

/** Mantener pulsado este tiempo el punto de salida. */
export const STAGE_EXIT_HOLD_MS = 2000;
const EXIT_SIZE = 64;
/** Límites del doble toque con dos dedos (blackout): movimiento máximo y tiempo por toque. */
const BLACKOUT_TAP_SLOP = 12;
const BLACKOUT_TAP_MS = 300;
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
  const scale = useRenderScale(!blackout);
  const { width, height } = useWindowDimensions();

  // Un pellizco también apoya dos dedos: sin estos límites, dos pellizcos seguidos
  // contaban como doble toque y la pantalla se ponía negra. Si los dedos se mueven o
  // tardan, ya no es un toque.
  const blackoutTap = Gesture.Tap()
    .numberOfTaps(2)
    .minPointers(2)
    .maxDistance(BLACKOUT_TAP_SLOP)
    .maxDuration(BLACKOUT_TAP_MS)
    .maxDelay(BLACKOUT_TAP_MS)
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
          // STG-02: el lienzo se dibuja a `scale` del tamaño y iOS lo amplía; así se pintan
          // menos píxeles de verdad (escalar dentro de Skia no ahorraría nada).
          <View
            style={[
              styles.scaled,
              { width: width * scale, height: height * scale, transform: [{ scale: 1 / scale }] },
            ]}
          >
            <EditorCanvas
              {...canvas}
              brush={null}
              xyLayerId={mode === "interactive" ? canvas.xyLayerId : null}
              extraGesture={mode === "interactive" ? blackoutTap : undefined}
            />
          </View>
        )}
        {DEV_TOOLS_ENABLED && <Text style={styles.devScale}>RES {Math.round(scale * 100)} %</Text>}
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

/**
 * Tiempo de cuadro medido en el hilo de UI (promedio exponencial) y sondeado desde JS cada
 * 250 ms para decidir la escala (sin llamar a JS desde el hilo de UI).
 */
function useRenderScale(active: boolean): number {
  const avg = useSharedValue(16.7);
  useFrameCallback((info) => {
    const dt = info.timeSincePreviousFrame;
    if (dt !== null && dt > 0 && dt < 250) avg.set(avg.get() * 0.9 + dt * 0.1);
  }, active);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!active) return;
    let state = FULL_SCALE;
    const id = setInterval(() => {
      state = stepRenderScale(state, avg.get(), 250);
      setScale((s) => (s === state.scale ? s : state.scale));
    }, 250);
    return () => clearInterval(id);
  }, [active, avg]);
  return scale;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scaled: { position: "absolute", top: 0, left: 0, transformOrigin: "top left" },
  devScale: {
    position: "absolute",
    right: 12,
    bottom: 12,
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1,
  },
  exit: { position: "absolute", top: 0, left: 0, width: EXIT_SIZE, height: EXIT_SIZE, alignItems: "center", justifyContent: "center" },
  ring: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2 },
});
