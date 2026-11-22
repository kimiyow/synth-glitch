import type { SkImage } from "@shopify/react-native-skia";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ComponentProps } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing,
  isSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { DEV_TOOLS_ENABLED } from "../dev/devTools";
import { FULL_SCALE, stepRenderScale } from "../engine/renderScale";
import { useStageScreen } from "../platform/screen";
import type { ScenePreset } from "../domain/types";
import { SCENE_FADE_BEATS, type SceneFadeBeats } from "../state/settings";
import { Icon } from "../ui/kit/Icon";
import { SceneThumb } from "../render/EffectThumb";
import { colors, radius, space, type } from "../ui/tokens";
import { ALL_ORIENTATIONS } from "../ui/useLayout";
import { EditorCanvas } from "./EditorCanvas";

// interactivo = el gesto X/Y del efecto seleccionado sigue activo; bloqueado = se ignora todo
export type StageMode = "interactive" | "locked";

// mantener pulsado este tiempo el punto de salida
export const STAGE_EXIT_HOLD_MS = 2000;
const EXIT_SIZE = 64;
// límites del doble toque con dos dedos (blackout): movimiento máximo y tiempo por toque
const BLACKOUT_TAP_SLOP = 12;
const BLACKOUT_TAP_MS = 300;
const RING = 30;
// tiempo que se ve el aviso de atajos al entrar
const HINT_MS = 2500;

// miniatura de cada escena en la tira
const SCENE_THUMB = 36;

type CanvasProps = Omit<ComponentProps<typeof EditorCanvas>, "brush" | "extraGesture" | "onCommitStroke" | "showSizePreview">;

// modo escenario: el lienzo a pantalla completa, sin barras ni paneles ni barra de estado; pantalla
// encendida y brillo al máximo (se restaura al salir). Para salir se mantiene 2 s el punto de la
// esquina superior izquierda; doble toque con dos dedos alterna el blackout (la salida se detiene
// sin cerrar el modo)
export function StageView({
  mode,
  canvas,
  onExit,
  scenes,
  activeSceneId,
  onScene,
  fadeBeats,
  onFadeBeats,
}: {
  mode: StageMode;
  canvas: CanvasProps;
  onExit: () => void;
  // escenas disparables (tira inferior en modo interactivo)
  scenes: readonly ScenePreset[];
  // escena que se ve ahora (tocarla la quita)
  activeSceneId: string | null;
  onScene: (preset: ScenePreset) => void;
  fadeBeats: SceneFadeBeats;
  onFadeBeats: (beats: SceneFadeBeats) => void;
}) {
  const still = isSharedValue(canvas.image) ? null : (canvas.image as SkImage);
  useStageScreen();
  const insets = useSafeAreaInsets();
  // aviso al entrar: se ve 2.5 s y se desvanece (nunca recibe toques)
  const reduced = useReducedMotion();
  const hint = useSharedValue(1);
  useEffect(() => {
    // con "Reducir movimiento" el aviso desaparece de golpe, sin fundido
    hint.set(withDelay(HINT_MS, withTiming(0, { duration: reduced ? 0 : 600 })));
  }, [hint, reduced]);
  const hintStyle = useAnimatedStyle(() => ({ opacity: hint.get() }));
  const [blackout, setBlackout] = useState(false);
  const toggleBlackout = () => setBlackout((b) => !b);
  const scale = useRenderScale(!blackout);
  const { width, height } = useWindowDimensions();

  // un pellizco también apoya dos dedos: sin estos límites, dos pellizcos seguidos contaban como
  // doble toque y la pantalla se ponía negra. Si los dedos se mueven o tardan, ya no es un toque
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

  // anillo de salida: se llena mientras se mantiene pulsado; al soltar antes, se vacía
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

  // bloqueado (o en blackout): una capa encima recibe todo y solo reconoce el blackout
  const shield = mode === "locked" || blackout;

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" supportedOrientations={[...ALL_ORIENTATIONS]}>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar hidden />
        {!blackout && (
          // el lienzo se dibuja a scale del tamaño y iOS lo amplía; así se pintan menos píxeles de
          // verdad (escalar dentro de Skia no ahorraría nada)
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
        {/* tira de escenas: tocar dispara con la transición elegida; la primera ficha la cambia */}
        {mode === "interactive" && !blackout && scenes.length > 0 && (
          <View style={[styles.strip, { bottom: insets.bottom + 12, left: insets.left, right: insets.right }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Transición: ${fadeBeats === 0 ? "corte" : `${fadeBeats} tiempos`}. Toca para cambiarla`}
                onPress={() => onFadeBeats(SCENE_FADE_BEATS[(SCENE_FADE_BEATS.indexOf(fadeBeats) + 1) % SCENE_FADE_BEATS.length])}
                style={({ pressed }) => [styles.fadeChip, pressed && styles.pressed]}
              >
                <Icon name="arrow.left.arrow.right" size={12} />
                <Text style={styles.fadeText}>{fadeBeats === 0 ? "CORTE" : `${fadeBeats} T`}</Text>
              </Pressable>
              {scenes.map((s) => {
                const on = s.id === activeSceneId;
                return (
                  <Pressable
                    key={s.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Escena ${s.name}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => onScene(s)}
                    style={({ pressed }) => [styles.sceneChip, on && styles.sceneChipOn, pressed && styles.pressed]}
                  >
                    {/* miniatura sobre la foto del proyecto (los clips no tienen cuadro fijo) */}
                    {still && (
                      <View style={styles.sceneThumb}>
                        <SceneThumb image={still} layers={s.layers} seed={canvas.seed} width={SCENE_THUMB} height={SCENE_THUMB} />
                      </View>
                    )}
                    <Text style={[styles.sceneText, on && styles.sceneTextOn]} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
        <Animated.View style={[styles.hint, { bottom: insets.bottom + (mode === "interactive" && scenes.length > 0 ? 72 : 24) }, hintStyle]} pointerEvents="none">
          <View style={styles.hintRow}>
            <Icon name="circle" size={12} />
            <Text style={styles.hintText}>MANTÉN 2 S LA ESQUINA PARA SALIR</Text>
          </View>
          <View style={styles.hintRow}>
            <Icon name="hand.tap" size={12} />
            <Text style={styles.hintText}>DOBLE TOQUE CON 2 DEDOS · NEGRO</Text>
          </View>
          {mode === "locked" && (
            <View style={styles.hintRow}>
              <Icon name="lock" size={12} />
              <Text style={styles.hintText}>BLOQUEADO · SE IGNORAN LOS TOQUES</Text>
            </View>
          )}
        </Animated.View>
        <GestureDetector gesture={Gesture.Simultaneous(exitHold, exitCommit)}>
          <View style={[styles.exit, { top: insets.top, left: insets.left }]} accessibilityRole="button" accessibilityLabel="Salir del modo escenario: mantén pulsado 2 segundos">
            <Animated.View style={[styles.ring, ringStyle]} />
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

// tiempo de cuadro medido en el hilo de UI (promedio exponencial) y sondeado desde JS cada 250 ms
// para decidir la escala (sin llamar a JS desde el hilo de UI)
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
  hint: {
    position: "absolute",
    alignSelf: "center",
    gap: 6,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.scrim,
  },
  strip: { position: "absolute" },
  sceneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    maxWidth: 160,
    paddingLeft: 4,
    paddingRight: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.scrim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inkLineStrong,
  },
  sceneChipOn: { backgroundColor: colors.paper, borderColor: colors.paper },
  sceneThumb: { width: SCENE_THUMB, height: SCENE_THUMB, borderRadius: radius.sm, overflow: "hidden" },
  sceneText: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  sceneTextOn: { color: colors.paperText },
  stripRow: { gap: 6, paddingHorizontal: space.lg, alignItems: "center" },
  fadeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 30,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inkLineStrong,
  },
  fadeText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  pressed: { opacity: 0.6 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  hintText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
});
