import { Canvas, Group, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { CropRect } from "../engine/crop";
import { buildEffectChain, type FrameInputs } from "../engine/renderGraph";
import type { Layer } from "../state/types";
import { colors, type } from "../ui/tokens";
import { SceneRenderer } from "./SceneRenderer";
import { clampAxis, clampZoom, fitContain } from "./viewTransform";

type Props = {
  image: SkImage;
  /** Tamaño de la región visible (recortada) en px de la imagen original. */
  contentWidth: number;
  contentHeight: number;
  layers: readonly Layer[];
  seed: number;
  crop?: CropRect;
  /** Toque de 1 dedo sobre el lienzo (cierra la superposición abierta, 3.9). */
  onTap?: () => void;
  /** Id de la capa que ajusta el gesto X/Y de 1 dedo (FX-04); null = desactivado. */
  xyLayerId?: string | null;
  onCommitXY?: (layerId: string, x: number, y: number) => void;
  onResetXY?: (layerId: string) => void;
};

/**
 * Lienzo del Editor: la escena ajustada al visor, con zoom de 0.5× a 8× y desplazamiento
 * con dos dedos (EDT-02). Todo el gesto vive en el hilo de UI (principio 2).
 * Un dedo queda libre para la herramienta (M5, M6).
 */
export function EditorCanvas(props: Props) {
  const { image, contentWidth, contentHeight, layers, seed, crop, onTap, xyLayerId = null, onCommitXY, onResetXY } = props;
  const [view, setView] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setView({ width, height });
  };

  const base = fitContain(view.width || 1, view.height || 1, contentWidth, contentHeight);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Estado al empezar el pellizco.
  const start = useSharedValue({ s: 1, tx: 0, ty: 0, fx: 0, fy: 0 });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      start.set({ s: scale.get(), tx: tx.get(), ty: ty.get(), fx: e.focalX, fy: e.focalY });
    })
    .onUpdate((e) => {
      const s0 = start.get();
      const s = clampZoom(s0.s * e.scale);
      // El punto bajo los dedos sigue a los dedos: zoom y desplazamiento a la vez.
      const nx = e.focalX - (s0.fx - s0.tx) * (s / s0.s);
      const ny = e.focalY - (s0.fy - s0.ty) * (s / s0.s);
      scale.set(s);
      tx.set(clampAxis(nx, s, base.x, base.width, view.width));
      ty.set(clampAxis(ny, s, base.y, base.height, view.height));
    });

  // Parámetros efectivos por nodo de la cadena: el gesto los cambia en el hilo de UI y
  // al soltar se confirman en el store; aquí se resincronizan con lo confirmado.
  const chain = buildEffectChain(layers);
  const committed = chain.flatMap((n) => [n.base.x, n.base.y]);
  const committedKey = committed.join(",");
  const liveParams = useSharedValue<number[]>(committed);
  useEffect(() => {
    liveParams.set(committedKey ? committedKey.split(",").map(Number) : []);
  }, [committedKey, liveParams]);

  const time = useSharedValue(0);
  useFrameCallback((info) => {
    time.set(info.timeSinceFirstFrame / 1000);
  });
  const frame = useDerivedValue<FrameInputs>(() => ({ time: time.get(), params: liveParams.get() }));

  // FX-04: arrastre relativo de 1 dedo (derecha = +X, arriba = +Y), un ancho de lienzo = rango completo.
  const idx = xyLayerId ? chain.findIndex((n) => n.layerId === xyLayerId) : -1;
  const xyEnabled = idx >= 0;
  const xyStart = useSharedValue({ x: 0, y: 0 });
  const xyPan = Gesture.Pan()
    .maxPointers(1)
    .enabled(xyEnabled)
    .onStart(() => {
      const p = liveParams.get();
      xyStart.set({ x: p[idx * 2], y: p[idx * 2 + 1] });
    })
    .onUpdate((e) => {
      const s = xyStart.get();
      const next = liveParams.get().slice();
      next[idx * 2] = Math.min(1, Math.max(0, s.x + e.translationX / view.width));
      next[idx * 2 + 1] = Math.min(1, Math.max(0, s.y - e.translationY / view.height));
      liveParams.set(next);
    });
  // Confirmación en el hilo de JS (runOnJS): así no se llama a JS desde un worklet (ver PerfHud).
  const xyCommit = Gesture.Pan()
    .maxPointers(1)
    .enabled(xyEnabled)
    .runOnJS(true)
    .onEnd((_e, success) => {
      const p = liveParams.get();
      // Un segundo dedo cancela el ajuste (SP-10): vuelve a lo confirmado.
      if (success && xyLayerId) onCommitXY?.(xyLayerId, p[idx * 2], p[idx * 2 + 1]);
      else liveParams.set(committed);
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(xyEnabled)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success && xyLayerId) onResetXY?.(xyLayerId);
    });
  const tap = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) onTap?.();
    });
  const gestures = Gesture.Simultaneous(pinch, xyPan, xyCommit, Gesture.Exclusive(doubleTap, tap));

  const transform = useDerivedValue(() => [
    { translateX: tx.get() },
    { translateY: ty.get() },
    { scale: scale.get() },
  ]);

  const resetStyle = useAnimatedStyle(() => ({ opacity: Math.abs(scale.get() - 1) > 0.01 ? 1 : 0 }));
  const reset = () => {
    scale.set(withTiming(1, { duration: 200 }));
    tx.set(withTiming(0, { duration: 200 }));
    ty.set(withTiming(0, { duration: 200 }));
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      {view.width > 0 && (
        <GestureDetector gesture={gestures}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Group transform={transform}>
              <Group transform={[{ translateX: base.x }, { translateY: base.y }]}>
                <SceneRenderer
                  image={image}
                  width={base.width}
                  height={base.height}
                  layers={layers}
                  seed={seed}
                  frame={frame}
                  crop={crop}
                />
              </Group>
            </Group>
          </Canvas>
        </GestureDetector>
      )}
      <Animated.View style={[styles.reset, resetStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a 1×" onPress={reset} hitSlop={8}>
          <Text style={styles.resetText}>1×</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", borderRadius: 12, backgroundColor: colors.ink },
  reset: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.inkSurface,
    borderColor: colors.inkLineStrong,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resetText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label },
});
