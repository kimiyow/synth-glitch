import { Canvas, Group, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import type { DerivedValue } from "react-native-reanimated";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  runOnUI,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { FULL_CROP, type CropRect } from "../engine/crop";
import { buildEffectChain, type FrameInputs } from "../engine/renderGraph";
import {
  advanceStroke,
  MAX_SIZE,
  MAX_STROKES,
  MIN_SIZE,
  STAMP_DEFAULTS,
  stampSeed,
  type BrushTool,
  type StrokeCursor,
} from "../paint/strokeInterpolate";
import type { Layer, Stamp, Stroke } from "../state/types";
import { colors, type } from "../ui/tokens";
import { SceneRenderer } from "./SceneRenderer";
import { usePaintBuffer } from "./usePaintBuffer";
import { clampAxis, clampZoom, fitContain, screenToImage } from "./viewTransform";

export type BrushConfig = {
  tool: BrushTool;
  /** Deslizadores 0-1: tamaño (1-40 % del ancho mostrado) y distancia mínima (1 px a 2 × tamaño). */
  size: number;
  spacing: number;
  sceneSeed: number;
};

export function brushScreenSize(size: number, displayedWidth: number) {
  return (MIN_SIZE + size * (MAX_SIZE - MIN_SIZE)) * displayedWidth;
}

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
  /** Pincel (M6): solo fotos. brush = null: herramienta inactiva. */
  paintable?: boolean;
  brush?: BrushConfig | null;
  strokes?: readonly Stroke[];
  mediaWidth?: number;
  mediaHeight?: number;
  overlayOpen?: boolean;
  showSizePreview?: boolean;
  onCommitStroke?: (stamps: Stamp[]) => void;
};

const NO_STROKES: readonly Stroke[] = [];

/**
 * Lienzo del Editor: la escena ajustada al visor, con zoom de 0.5× a 8× y desplazamiento
 * con dos dedos (EDT-02). Todo el gesto vive en el hilo de UI (principio 2).
 * Un dedo queda libre para la herramienta (M5, M6).
 */
export function EditorCanvas(props: Props) {
  const { image, contentWidth, contentHeight, layers, seed, crop, onTap, xyLayerId = null, onCommitXY, onResetXY } = props;
  const { paintable = false, brush = null, strokes = NO_STROKES, overlayOpen = false, showSizePreview = false } = props;
  const mediaWidth = props.mediaWidth ?? contentWidth;
  const mediaHeight = props.mediaHeight ?? contentHeight;
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

  const paint = usePaintBuffer(paintable ? image : null, mediaWidth, mediaHeight, strokes);
  const cancelled = useSharedValue(false);
  const live = useSharedValue<Stamp[]>([]);

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      // Un segundo dedo durante un trazo lo cancela (EDT-02, CA-11).
      cancelled.set(true);
      if (live.get().length > 0) paint.cancelStroke();
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
  // Pincel (3.6): tamaño y distancia constantes en pantalla; se pasan a la imagen según el zoom (BRU-05).
  const cropR = crop ?? FULL_CROP;
  const brushOn = paintable && brush !== null && strokes.length < MAX_STROKES && view.width > 0;
  const sizeScreen = brush ? brushScreenSize(brush.size, base.width) : 0;
  const spacingScreen = brush ? 1 + brush.spacing * Math.max(0, 2 * sizeScreen - 1) : 1;
  const fullDisplayW = base.width / cropR[2];
  const aspectHW = mediaHeight / mediaWidth;
  const tool = brush?.tool ?? "datamosh";
  const sceneSeed = brush?.sceneSeed ?? 0;
  const strokeIndex = strokes.length;
  const cursor = useSharedValue<StrokeCursor>(null);

  const placeAt = (px: number, py: number) => {
    "worklet";
    const s = scale.get();
    const uv = screenToImage(px, py, s, tx.get(), ty.get(), base);
    const mx = cropR[0] + uv.x * cropR[2];
    const my = (cropR[1] + uv.y * cropR[3]) * aspectHW;
    const sizeN = Math.min(MAX_SIZE, Math.max(MIN_SIZE, sizeScreen / (s * fullDisplayW)));
    const r = advanceStroke(cursor.get(), mx, my, spacingScreen / (s * fullDisplayW));
    cursor.set(r.cursor);
    if (r.stamps.length === 0) return;
    const prev = live.get();
    const erase = tool === "erase";
    const added: Stamp[] = r.stamps.map((p, i) => ({
      x: p.x,
      y: p.y,
      size: sizeN,
      effect: tool === "erase" ? "datamosh" : tool,
      erase,
      params: tool === "erase" ? [] : STAMP_DEFAULTS[tool],
      seed: stampSeed(sceneSeed, strokeIndex, prev.length + i),
    }));
    live.set(prev.concat(added));
    paint.addStamps(added);
  };
  const startStroke = (px: number, py: number) => {
    "worklet";
    cursor.set(null);
    live.set([]);
    cancelled.set(false);
    paint.beginStroke();
    placeAt(px, py);
  };
  // Con un panel abierto, un toque lo cierra y no pinta (S8): el trazo empieza al arrastrar.
  const brushPan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(overlayOpen ? 8 : 0)
    .enabled(brushOn)
    .onBegin((e) => {
      if (!overlayOpen) startStroke(e.x, e.y);
    })
    .onStart((e) => {
      if (overlayOpen) startStroke(e.x, e.y);
    })
    .onUpdate((e) => {
      if (!cancelled.get()) placeAt(e.x, e.y);
    });
  // Confirmación del trazo en el hilo de JS: una llamada por gesto (3.2).
  const brushCommit = Gesture.Pan()
    .maxPointers(1)
    .minDistance(overlayOpen ? 8 : 0)
    .enabled(brushOn)
    .runOnJS(true)
    .onFinalize(() => {
      const stamps = live.get();
      live.set([]);
      if (stamps.length === 0) return;
      if (cancelled.get()) {
        runOnUI(paint.cancelStroke)();
        return;
      }
      paint.liveCommitted.set(true);
      props.onCommitStroke?.(stamps);
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) onTap?.();
    });
  const gestures = Gesture.Simultaneous(pinch, xyPan, xyCommit, brushPan, brushCommit, Gesture.Exclusive(doubleTap, tap));
  const sceneImage: SkImage | DerivedValue<SkImage | null> = paintable && paint.ready ? paint.shown : image;

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
                  image={sceneImage}
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
      {showSizePreview && brush && (
        // BRU-02: cuadrado del tamaño real del sello en pantalla.
        <View pointerEvents="none" style={styles.previewWrap}>
          <View style={[styles.preview, { width: sizeScreen, height: sizeScreen }]} />
        </View>
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
  previewWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  preview: { borderColor: colors.inkText, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.15)" },
});
