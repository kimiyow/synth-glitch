import { Canvas, Group, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import type { SharedValue } from "react-native-reanimated";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector, type GestureType } from "react-native-gesture-handler";
import Animated, {
  isSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  runOnUI,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { FULL_CROP, type CropRect } from "../engine/crop";
import { buildLayerChain, type FrameInputs } from "../engine/renderGraph";
import { evaluate } from "../modulation/evaluate";
import { FadeOutScene, type SceneFade } from "./FadeOutScene";
import { recInput, useModBus, type ModBus } from "./modBus";
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
import type { Layer, Route, SourceConfig, Stamp, Stroke } from "../domain/types";
import { colors, type } from "../ui/tokens";
import { SceneRenderer, type PaintInput } from "../render/SceneRenderer";
import { emptyMask, usePaintBuffer } from "./usePaintBuffer";
import { paintChainIndex } from "../paint/paintStack";
import { clampAxis, clampZoom, fitContain, fitCover, screenToImage } from "./viewTransform";

export type BrushConfig = {
  tool: BrushTool;
  // deslizadores 0-1: tamaño (1-40 % del ancho mostrado) y distancia mínima (1 px a 2 × tamaño)
  size: number;
  spacing: number;
  sceneSeed: number;
};

export function brushScreenSize(size: number, displayedWidth: number) {
  return (MIN_SIZE + size * (MAX_SIZE - MIN_SIZE)) * displayedWidth;
}

type Props = {
  // foto o base generativa; en clips, el cuadro actual del video
  image: SkImage | SharedValue<SkImage | null>;
  // 1 mientras hay un dedo sobre la imagen (lo escribe el hilo de UI)
  working?: SharedValue<number>;
  // gesto adicional simultáneo (modo escenario: blackout con dos dedos)
  extraGesture?: GestureType;
  // llenar el visor recortando (escenario) en lugar de ajustar la imagen completa
  cover?: boolean;
  // micrófono: nivel 0..1 y contador de golpes, escritos desde JS
  mic?: { level: SharedValue<number>; hits: SharedValue<number> };
  // señales en vivo compartidas con los paneles (vista en vivo de la modulación)
  bus?: ModBus;
  // crossfade en curso: la escena anterior se desvanece encima de la actual
  fadeFrom?: SceneFade | null;
  // giro de los cuadros del video y su tamaño sin rotar
  rotation?: 0 | 90 | 180 | 270;
  sourceSize?: { width: number; height: number };
  // tamaño de la región visible (recortada) en px de la imagen original
  contentWidth: number;
  contentHeight: number;
  layers: readonly Layer[];
  // modulación: se evalúa en cada cuadro en el hilo de UI
  routes: readonly Route[];
  sources: SourceConfig;
  seed: number;
  crop?: CropRect;
  // id de la capa que ajusta el gesto X/Y de 1 dedo; null = desactivado
  xyLayerId?: string | null;
  onCommitXY?: (layerId: string, x: number, y: number) => void;
  onResetXY?: (layerId: string) => void;
  // pincel: solo fotos. brush = null: herramienta inactiva
  paintable?: boolean;
  brush?: BrushConfig | null;
  strokes?: readonly Stroke[];
  // capa PINTURA: ojo de la fila y lugar en la pila (scene.paint)
  paintVisible?: boolean;
  paintIndex?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  showSizePreview?: boolean;
  onCommitStroke?: (stamps: Stamp[]) => void;
};

const NO_STROKES: readonly Stroke[] = [];

// lienzo del Editor: la escena ajustada al visor, con zoom de 0.5× a 8× y desplazamiento con dos
// dedos. Todo el gesto vive en el hilo de UI. Un dedo queda libre para la herramienta
export function EditorCanvas(props: Props) {
  const { routes, sources } = props;
  const { image, contentWidth, contentHeight, layers, seed, crop, xyLayerId = null, onCommitXY, onResetXY } = props;
  const { paintable = false, brush = null, strokes = NO_STROKES, showSizePreview = false } = props;
  const { paintVisible = true, paintIndex = 0 } = props;
  const mediaWidth = props.mediaWidth ?? contentWidth;
  const mediaHeight = props.mediaHeight ?? contentHeight;
  const [view, setView] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setView({ width, height });
  };

  // cover (escenario): la imagen llena la pantalla sin franjas vacías, en cualquier orientación
  const base = (props.cover ? fitCover : fitContain)(view.width || 1, view.height || 1, contentWidth, contentHeight);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // estado al empezar el pellizco
  const start = useSharedValue({ s: 1, tx: 0, ty: 0, fx: 0, fy: 0 });

  // la pintura solo existe sobre una imagen fija (foto o generativo)
  const still = isSharedValue(image) ? null : (image as SkImage);
  const paint = usePaintBuffer(paintable ? still : null, mediaWidth, mediaHeight, strokes);
  const cancelled = useSharedValue(false);
  const live = useSharedValue<Stamp[]>([]);
  // pintar sobre la capa PINTURA oculta la muestra desde el primer sello; el trazo confirmado la
  // vuelve visible en el store
  const stroking = useSharedValue(false);
  useEffect(() => {
    stroking.set(false);
  }, [paintVisible, stroking]);
  const blankMask = emptyMask();
  const shownMask = useDerivedValue(() => (paintVisible || stroking.get() ? paint.mask.get() : blankMask));

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      // un segundo dedo durante un trazo lo cancela
      cancelled.set(true);
      if (live.get().length > 0) {
        stroking.set(false);
        paint.cancelStroke();
      }
      start.set({ s: scale.get(), tx: tx.get(), ty: ty.get(), fx: e.focalX, fy: e.focalY });
    })
    .onUpdate((e) => {
      const s0 = start.get();
      const s = clampZoom(s0.s * e.scale);
      // el punto bajo los dedos sigue a los dedos: zoom y desplazamiento a la vez
      const nx = e.focalX - (s0.fx - s0.tx) * (s / s0.s);
      const ny = e.focalY - (s0.fy - s0.ty) * (s / s0.s);
      scale.set(s);
      tx.set(clampAxis(nx, s, base.x, base.width, view.width));
      ty.set(clampAxis(ny, s, base.y, base.height, view.height));
    });

  // parámetros efectivos por nodo de la cadena: el gesto los cambia en el hilo de UI y al soltar se
  // confirman en el store; aquí se resincronizan con lo confirmado
  const chain = buildLayerChain(layers);
  const committed = chain.flatMap((n) => [n.base.x, n.base.y]);
  const committedKey = committed.join(",");
  const liveParams = useSharedValue<number[]>(committed);
  useEffect(() => {
    liveParams.set(committedKey ? committedKey.split(",").map(Number) : []);
  }, [committedKey, liveParams]);

  const ownBus = useModBus();
  const bus = props.bus ?? ownBus;
  const time = bus.time;
  useFrameCallback((info) => {
    time.set(info.timeSinceFirstFrame / 1000);
  });
  // ADSR: se dispara al apoyar cualquier dedo sobre la imagen y se suelta al levantarlo
  const gateOn = bus.gateOn;
  const gateOff = bus.gateOff;
  // micrófono: el nivel lo escribe JS; un golpe nuevo (contador) dispara el ADSR
  const noMic = useSharedValue(0);
  const micLevel = props.mic?.level ?? noMic;
  const micHits = props.mic?.hits ?? noMic;
  const working = props.working;
  const seenHits = useSharedValue(0);
  // último golpe del micrófono: lo usan las modulaciones MIC en modo golpes y los ADSR por micrófono
  const micHitAt = bus.micHitAt;
  useFrameCallback(() => {
    const h = micHits.get();
    if (h === seenHits.get()) return;
    seenHits.set(h);
    micHitAt.set(time.get());
  });
  const chainLayers = chain.map((n) => ({ id: n.layerId, params: n.base }));
  // mientras se arrastra un ajuste de modulación, el efecto sigue el valor provisional; cuando llegan
  // las modulaciones confirmadas (al soltar) se descarta
  const draftRoutes = bus.draftRoutes;
  useEffect(() => {
    draftRoutes.set(null);
  }, [routes, draftRoutes]);
  const frame = useDerivedValue<FrameInputs>(() => {
    const t = time.get();
    const draft = draftRoutes.get();
    const lp = liveParams.get();
    const touch: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < chainLayers.length; i++) {
      touch[chainLayers[i].id] = { x: lp[i * 2] ?? chainLayers[i].params.x, y: lp[i * 2 + 1] ?? chainLayers[i].params.y };
    }
    const inputs = {
      touch,
      gateOnAt: gateOn.get(),
      gateOffAt: gateOff.get(),
      mic: micLevel.get(),
      micHitAt: micHitAt.get(),
      track: null,
      rec: recInput(bus),
    };
    return { time: t, params: evaluate(chainLayers, draft ?? routes, sources, t, inputs, seed) };
  });
  const gate = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onBegin(() => {
      gateOn.set(time.get());
      gateOff.set(null);
      working?.set(1);
    })
    .onFinalize(() => {
      gateOff.set(time.get());
      working?.set(0);
    });

  // arrastre relativo de 1 dedo (derecha = +X, arriba = +Y), un ancho de lienzo = rango completo
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
  // confirmación en el hilo de JS (runOnJS): así no se llama a JS desde un worklet (ver PerfHud)
  const xyCommit = Gesture.Pan()
    .maxPointers(1)
    .enabled(xyEnabled)
    .runOnJS(true)
    .onEnd((_e, success) => {
      const p = liveParams.get();
      // un segundo dedo cancela el ajuste: vuelve a lo confirmado
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
  // pincel: tamaño y distancia constantes en pantalla; se pasan a la imagen según el zoom
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
    stroking.set(true);
    paint.beginStroke();
    placeAt(px, py);
  };
  // al apoyar el dedo se coloca un sello, también con un panel abierto: los paneles solo se cierran
  // con su propio botón
  const brushPan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(0)
    .enabled(brushOn)
    .onBegin((e) => startStroke(e.x, e.y))
    .onUpdate((e) => {
      if (!cancelled.get()) placeAt(e.x, e.y);
    });
  // confirmación del trazo en el hilo de JS: una llamada por gesto
  const brushCommit = Gesture.Pan()
    .maxPointers(1)
    .minDistance(0)
    .enabled(brushOn)
    .runOnJS(true)
    .onFinalize(() => {
      const stamps = live.get();
      live.set([]);
      if (stamps.length === 0) return;
      if (cancelled.get()) {
        stroking.set(false);
        runOnUI(paint.cancelStroke)();
        return;
      }
      paint.liveCommitted.set(true);
      props.onCommitStroke?.(stamps);
    });

  const toolGestures = [pinch, gate, xyPan, xyCommit, brushPan, brushCommit, doubleTap];
  const gestures = Gesture.Simultaneous(...toolGestures, ...(props.extraGesture ? [props.extraGesture] : []));
  // la pintura va siempre en el árbol de una foto: el primer sello se ve sin esperar al store
  const paintInput: PaintInput | null = paintable && paint.ready ? { image: paint.shown, mask: shownMask, at: paintChainIndex(layers, paintIndex) } : null;
  const rotation = props.rotation ?? 0;

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
    <View style={[styles.root, props.cover && styles.rootFill]} onLayout={onLayout}>
      {view.width > 0 && (
        <GestureDetector gesture={gestures}>
          <Canvas
            style={StyleSheet.absoluteFill}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Imagen en edición. Arrastra para pintar o ajustar el efecto seleccionado; pellizca para hacer zoom"
          >
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
                  rotation={rotation}
                  sourceSize={props.sourceSize}
                  paint={paintInput}
                />
                {props.fadeFrom && (
                  <FadeOutScene
                    // cada fundido es una escena distinta: se monta de nuevo
                    key={props.fadeFrom.start}
                    fade={props.fadeFrom}
                    bus={bus}
                    micLevel={micLevel}
                    image={image}
                    paint={paintInput}
                    paintIndex={paintIndex}
                    width={base.width}
                    height={base.height}
                    sources={sources}
                    seed={seed}
                    crop={crop}
                    rotation={rotation}
                    sourceSize={props.sourceSize}
                  />
                )}
              </Group>
            </Group>
          </Canvas>
        </GestureDetector>
      )}
      {showSizePreview && brush && (
        // cuadrado del tamaño real del sello en pantalla
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
  root: { flex: 1, overflow: "hidden", borderRadius: 22, backgroundColor: colors.inkSurface },
  rootFill: { borderRadius: 0, backgroundColor: colors.ink },
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
  preview: { borderColor: colors.inkText, borderWidth: 1, backgroundColor: colors.inkLine },
});
