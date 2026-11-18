import { Canvas, Circle, Line, Points, vec } from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

import { useLiveMod } from "../../canvas/modBus";
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
  const bipolar = route.source === "lfo" || route.source === "sh";
  const signal = useSharedValue<number[]>([]);
  const result = useSharedValue<number[]>([]);

  useFrameCallback((info) => {
    const bus = live?.bus;
    const t = bus ? bus.time.get() : info.timeSinceFirstFrame / 1000;
    const inputs: ModInputs = {
      touch: {},
      gateOnAt: bus ? bus.gateOn.get() : null,
      gateOffAt: bus ? bus.gateOff.get() : null,
      orientation: { x: 0, y: 0 },
      mic: live ? live.micLevel.get() : 0,
      micHitAt: bus ? bus.micHitAt.get() : null,
      track: null,
    };
    const seed = live ? live.seed : 0;
    const v = sourceValue(route, sources, t, inputs, seed + Math.max(0, index) * 7919, base);
    const u = bipolar ? (v + 1) / 2 : v;
    const r = evaluateAxis(route.target.layerId, route.target.param, base, routes, sources, t, inputs, seed);
    const s = signal.get();
    const p = result.get();
    const ns = s.length >= N ? s.slice(1) : s.slice();
    const np = p.length >= N ? p.slice(1) : p.slice();
    ns.push(Math.min(1, Math.max(0, u)));
    np.push(r);
    signal.set(ns);
    result.set(np);
  });

  const h = height - PAD * 2;
  const toPoints = (vals: number[]) => {
    "worklet";
    const out = [];
    const start = N - vals.length;
    for (let i = 0; i < vals.length; i++) out.push({ x: ((start + i) / (N - 1)) * (width - 6), y: PAD + (1 - vals[i]) * h });
    return out;
  };
  const signalPts = useDerivedValue(() => toPoints(signal.get()));
  const resultPts = useDerivedValue(() => toPoints(result.get()));
  const dotY = useDerivedValue(() => {
    const s = signal.get();
    return PAD + (1 - (s.length ? s[s.length - 1] : 0)) * h;
  });
  const resultDotY = useDerivedValue(() => {
    const p = result.get();
    return PAD + (1 - (p.length ? p[p.length - 1] : 0)) * h;
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
