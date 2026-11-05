import { Canvas } from "@shopify/react-native-skia";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

import { SceneRenderer } from "../../editor/SceneRenderer";
import type { FrameInputs } from "../../engine/renderGraph";
import { evaluate, NO_INPUTS } from "../../modulation/evaluate";
import { DEFAULT_SOURCES } from "../../modulation/sources";
import type { Layer, Route } from "../../state/types";
import { geometry } from "../../ui/tokens";
import { LabChip, labStyles } from "./labUi";
import { useTestImage } from "./testImage";

/** NFR-15: 30 min con ≥ 45 FPS. */
export const STAGE_TEST_MIN = 30;
export const STAGE_MIN_FPS = 45;

/** Escena típica de escenario: 3 capas y una ruta LFO, dentro del umbral de costo. */
const LAYERS: Layer[] = [
  { kind: "effect", id: "chr", effect: "chromatic", params: { x: 0.3, y: 0 }, visible: true },
  { kind: "effect", id: "vhs", effect: "vhs", params: { x: 0.3, y: 0.4 }, visible: true },
  { kind: "generator", id: "noi", generator: "noise", params: { x: 0.3, y: 0.3 }, visible: true, blend: "screen" },
];
const ROUTES: Route[] = [
  { id: "r", source: "lfo", sourceIndex: 0, target: { layerId: "chr", param: "x" }, amount: 0.5, curve: "lin", mode: "add" },
];
const SOURCES = { ...DEFAULT_SOURCES, lfo: { ...DEFAULT_SOURCES.lfo, depth: 1, sync: false, rateHz: 0.5 } };

type Minute = { minute: number; minFps: number; avgFps: number };

/**
 * NFR-15 / CA-27: 30 min de escenario a pantalla encendida, midiendo FPS por segundo en el
 * hilo de UI (solo números en valores compartidos) y anotando el mínimo y el promedio por minuto.
 */
export function StageEnduranceLab() {
  const image = useTestImage();
  const [running, setRunning] = useState(false);
  if (!image) return <Text style={[labStyles.label, { padding: geometry.compactMargin }]}>GENERANDO IMAGEN…</Text>;
  return running ? <Run image={image} onStop={() => setRunning(false)} /> : (
    <View style={labStyles.controls}>
      <LabChip label={`EMPEZAR ${STAGE_TEST_MIN} MIN`} onPress={() => setRunning(true)} />
      <Text style={labStyles.label}>
        Deja el teléfono quieto y conectado. Pasa si en todos los minutos el FPS mínimo es ≥ {STAGE_MIN_FPS} y la app no
        se cierra.
      </Text>
    </View>
  );
}

function Run({ image, onStop }: { image: NonNullable<ReturnType<typeof useTestImage>>; onStop: () => void }) {
  useKeepAwake("synthvj-stage-test");
  const { width } = useWindowDimensions();
  const height = Math.round((width * 4) / 3);
  const time = useSharedValue(0);
  const frames = useSharedValue(0);
  useFrameCallback((info) => {
    time.set(info.timeSinceFirstFrame / 1000);
    frames.set(frames.get() + 1);
  });
  const chain = LAYERS.map((l) => ({ id: l.id, params: l.params }));
  const frame = useDerivedValue<FrameInputs>(() => {
    const t = time.get();
    return { time: t, params: evaluate(chain, ROUTES, SOURCES, t, NO_INPUTS, 7) };
  });

  const [elapsed, setElapsed] = useState(0);
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const perSecond = useRef<number[]>([]);

  useEffect(() => {
    const started = Date.now();
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const fps = (frames.get() * 1000) / (now - last);
      frames.set(0);
      last = now;
      perSecond.current.push(fps);
      const s = Math.floor((now - started) / 1000);
      setElapsed(s);
      if (perSecond.current.length >= 60) {
        const list = perSecond.current;
        perSecond.current = [];
        const entry = {
          minute: Math.round(s / 60),
          minFps: Math.min(...list),
          avgFps: list.reduce((a, b) => a + b, 0) / list.length,
        };
        setMinutes((m) => [entry, ...m]);
      }
      if (s >= STAGE_TEST_MIN * 60) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [frames]);

  const done = elapsed >= STAGE_TEST_MIN * 60;
  const worst = minutes.length ? Math.min(...minutes.map((m) => m.minFps)) : null;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <ScrollView>
      <Canvas style={{ width, height }}>
        <SceneRenderer image={image} width={width} height={height} layers={LAYERS} seed={7} frame={frame} />
      </Canvas>
      <View style={labStyles.controls}>
        <Text style={labStyles.data}>
          {mm}:{ss} / {STAGE_TEST_MIN}:00 · PEOR MINUTO {worst === null ? "—" : `${worst.toFixed(0)} FPS`}
          {done ? (worst !== null && worst >= STAGE_MIN_FPS ? " · PASA" : " · NO PASA") : ""}
        </Text>
        <LabChip label="DETENER" onPress={onStop} />
        {minutes.map((m) => (
          <Text key={m.minute} style={labStyles.data}>
            MIN {m.minute} · MÍN {m.minFps.toFixed(0)} · PROM {m.avgFps.toFixed(0)} FPS
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
