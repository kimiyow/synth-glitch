import { Canvas, Circle, Line, Points, vec } from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

import { oriInput, recInput, useLiveMod } from "../../canvas/modBus";
import type { Route, SourceConfig } from "../../domain/types";
import { evaluateAxis, sourceValue, type ModInputs } from "../../modulation/evaluate";
import { colors } from "../tokens";

// ~2 s de historia a 60 fps
const N = 120;
const PAD = 4;

type Props = {
  route: Route;
  // todas las rutas de la escena: el resultado suma todas las modulaciones del parámetro
  routes: readonly Route[];
  sources: SourceConfig;
  base: { x: number; y: number };
  width: number;
  height: number;
};

// osciloscopio en vivo de una modulación: la señal de su fuente (blanco) y el valor que toma el
// parámetro con todas sus modulaciones (gris), con el mismo reloj y entradas que el lienzo
export function LiveScope({ route, routes, sources, base, width, height }: Props) {
  const live = useLiveMod();
  const index = routes.findIndex((r) => r.id === route.id);
  const bipolar = route.source === "lfo" || route.source === "sh" || route.source === "orientation";
  // búfer circular intercalado [señal, resultado] de N muestras: cada cuadro escribe en su sitio
  // (modify) en lugar de copiar dos arreglos
  const buffer = useSharedValue<number[]>(new Array(N * 2).fill(0));
  const head = useSharedValue(0);
  const count = useSharedValue(0);

  useFrameCallback((info) => {
    const bus = live?.bus;
    const t = bus ? bus.time.get() : info.timeSinceFirstFrame / 1000;
    const inputs: ModInputs = {
      touch: {},
      gateOnAt: bus ? bus.gateOn.get() : null,
      gateOffAt: bus ? bus.gateOff.get() : null,
      orientation: bus ? oriInput(bus) : { x: 0, y: 0 },
      mic: live ? live.micLevel.get() : 0,
      micHitAt: bus ? bus.micHitAt.get() : null,
      track: null,
      rec: bus ? recInput(bus) : null,
    };
    const seed = live ? live.seed : 0;
    const v = sourceValue(route, sources, t, inputs, seed + Math.max(0, index) * 7919, base);
    const u = bipolar ? (v + 1) / 2 : v;
    const r = evaluateAxis(route.target.layerId, route.target.param, base, routes, sources, t, inputs, seed);
    const i = head.get();
    const su = Math.min(1, Math.max(0, u));
    buffer.modify((b) => {
      "worklet";
      b[i * 2] = su;
      b[i * 2 + 1] = r;
      return b;
    });
    head.set((i + 1) % N);
    count.set(Math.min(N, count.get() + 1));
  });

  const h = height - PAD * 2;
  // puntos de una pista (0 = señal, 1 = resultado), de la muestra más vieja a la más nueva
  const toPoints = (track: 0 | 1) => {
    "worklet";
    const b = buffer.get();
    const n = count.get();
    const h0 = head.get();
    const out = [];
    for (let k = 0; k < n; k++) {
      const idx = (h0 - n + k + N) % N;
      out.push({ x: ((N - n + k) / (N - 1)) * (width - 6), y: PAD + (1 - b[idx * 2 + track]) * h });
    }
    return out;
  };
  const last = (track: 0 | 1) => {
    "worklet";
    if (count.get() === 0) return 0;
    return buffer.get()[((head.get() - 1 + N) % N) * 2 + track];
  };
  const signalPts = useDerivedValue(() => toPoints(0));
  const resultPts = useDerivedValue(() => toPoints(1));
  const dotY = useDerivedValue(() => PAD + (1 - last(0)) * h);
  const resultDotY = useDerivedValue(() => {
    return PAD + (1 - last(1)) * h;
  });
  const mid = bipolar ? PAD + h / 2 : PAD + h;

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Line p1={vec(0, mid)} p2={vec(width, mid)} color={colors.inkLine} strokeWidth={1} />
      <Points points={resultPts} mode="polygon" color={colors.inkMute} strokeWidth={1.5} style="stroke" />
      <Points points={signalPts} mode="polygon" color={colors.inkText} strokeWidth={2} style="stroke" strokeJoin="round" />
      <Circle cx={width - 6} cy={resultDotY} r={3} color={colors.inkMute} />
      <Circle cx={width - 6} cy={dotY} r={4} color={colors.inkText} />
    </Canvas>
  );
}
