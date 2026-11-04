import { Canvas, drawAsImage, Image as SkiaImage, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import { SceneRenderer } from "../../editor/SceneRenderer";
import { COST_WARNING_THRESHOLD, estimateLayerCost, isCostHigh } from "../../engine/layerCost";
import { EFFECTS } from "../../engine/registry";
import type { FrameInputs } from "../../engine/renderGraph";
import type { Layer } from "../../state/types";
import { LabChip, labStyles } from "./labUi";
import { useTestImage } from "./testImage";
import { useLabClock } from "./useLabClock";

const COUNTS = [1, 2, 3, 5, 8] as const;
const ORDERS = {
  mezcla: EFFECTS.map((e) => e.id),
  baratos: ["wave", "pixelate", "datamosh", "scanlines"] as const,
};
type OrderKey = keyof typeof ORDERS;

function buildLayers(count: number, order: OrderKey): Layer[] {
  const ids = ORDERS[order];
  return Array.from({ length: count }, (_, i) => {
    const effect = EFFECTS.find((e) => e.id === ids[i % ids.length])!;
    return { kind: "effect", id: `l${i}`, effect: effect.id, params: { ...effect.defaults }, visible: true };
  });
}

/**
 * SP-04: FPS con 1, 2, 3, 5 y 8 capas reales (para calibrar el umbral de costo)
 * y comprobación de que exportar da lo mismo que el preview (principio 1).
 */
export function StackBench() {
  const image = useTestImage();
  const { width } = useWindowDimensions();
  const canvasH = Math.round((width * 4) / 3);
  const [count, setCount] = useState<number>(3);
  const [order, setOrder] = useState<OrderKey>("mezcla");
  const [paused, setPaused] = useState(false);
  const [exported, setExported] = useState<SkImage | null>(null);
  const layers = useMemo(() => buildLayers(count, order), [count, order]);

  const clock = useLabClock();
  const frozenAt = useSharedValue(0);
  const isPaused = useSharedValue(false);
  const touch = useSharedValue<[number, number] | null>(null);
  const frame = useDerivedValue<FrameInputs>(() => {
    const t = isPaused.get() ? frozenAt.get() : clock.get();
    const p = touch.get();
    return { time: t, params: p ? layers.flatMap(() => [p[0], p[1]]) : [] };
  });

  useEffect(() => () => exported?.dispose(), [exported]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onUpdate((e) => {
      touch.set([Math.min(1, Math.max(0, e.x / width)), Math.min(1, Math.max(0, 1 - e.y / canvasH))]);
    });

  const togglePause = () => {
    if (!paused) frozenAt.set(clock.get());
    isPaused.set(!paused);
    setPaused(!paused);
    setExported(null);
  };

  const exportAndCompare = async () => {
    if (!image) return;
    const snapshot: FrameInputs = { ...frame.get() };
    const result = await drawAsImage(
      <SceneRenderer image={image} width={width} height={canvasH} layers={layers} seed={0} frame={snapshot} />,
      { width, height: canvasH },
    );
    setExported(result);
  };

  if (!image) return <Text style={labStyles.label}>GENERANDO IMAGEN…</Text>;
  const cost = estimateLayerCost(layers);

  return (
    <ScrollView>
      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height: canvasH }}>
          <SceneRenderer image={image} width={width} height={canvasH} layers={layers} seed={0} frame={frame} />
        </Canvas>
      </GestureDetector>

      <View style={labStyles.controls}>
        <Text style={labStyles.data}>
          {layers.map((l) => (l.kind === "effect" ? l.effect : l.generator)).join(" → ")}
        </Text>
        <Text style={labStyles.data}>
          COSTO {cost} (umbral {COST_WARNING_THRESHOLD})
        </Text>
        {isCostHigh(layers) && (
          <Text style={[labStyles.data, labStyles.warn]}>RENDIMIENTO BAJO · {layers.length} CAPAS</Text>
        )}

        <Text style={labStyles.label}>CAPAS</Text>
        <View style={labStyles.row}>
          {COUNTS.map((n) => (
            <LabChip key={n} label={String(n)} active={n === count} onPress={() => setCount(n)} />
          ))}
        </View>
        <Text style={labStyles.label}>EFECTOS</Text>
        <View style={labStyles.row}>
          {(Object.keys(ORDERS) as OrderKey[]).map((k) => (
            <LabChip key={k} label={k.toUpperCase()} active={k === order} onPress={() => setOrder(k)} />
          ))}
        </View>

        <Text style={labStyles.label}>PREVIEW = EXPORTACIÓN</Text>
        <View style={labStyles.row}>
          <LabChip label={paused ? "REANUDAR" : "PAUSAR TIEMPO"} active={paused} onPress={togglePause} />
          <LabChip label="EXPORTAR Y COMPARAR" disabled={!paused} onPress={exportAndCompare} />
        </View>
        {exported && (
          <>
            <Text style={labStyles.label}>EXPORTADO CON drawAsImage (debe verse idéntico al de arriba)</Text>
            <Canvas style={{ width: width - 32, height: Math.round(((width - 32) * 4) / 3) }}>
              <SkiaImage image={exported} x={0} y={0} width={width - 32} height={Math.round(((width - 32) * 4) / 3)} fit="fill" />
            </Canvas>
          </>
        )}
        <Text style={labStyles.label}>
          Mide los FPS de UI del HUD arrastrando 10 s por cada número de capas.
        </Text>
      </View>
    </ScrollView>
  );
}
