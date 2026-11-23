import { Canvas, Circle, Line, Points, vec } from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

import { oriInput, recInput, useLiveMod } from "../../canvas/modBus";
import type { Route, SourceConfig } from "../../domain/types";
import { evaluateAxis, sourceValue, type ModInputs } from "../../modulation/evaluate";
import { adsrActive, previewInputs, scopeComputed, scopeWindowS } from "../../modulation/scopeWindow";
import { colors } from "../tokens";

// muestras de la gráfica (y de la historia: ~2 s a 60 fps)
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
// parámetro con todas sus modulaciones (gris), con el mismo reloj y entradas que el lienzo.
// Si la señal depende solo del tiempo (LFO, azar, pasos, pulso, gesto grabado, ADSR de muestra) la
// curva se calcula entera en cada cuadro: se ve completa desde el inicio y cambia al instante con
// cada ajuste (también mientras se arrastra). Micrófono, giro y el ADSR que estás disparando
// muestran su historia; arranca como una línea plana en su valor actual, nunca vacía
export function LiveScope({ route, routes, sources, base, width, height }: Props) {
  const live = useLiveMod();
  const index = routes.findIndex((r) => r.id === route.id);
  const bipolar = route.source === "lfo" || route.source === "sh" || route.source === "orientation";
  const computed = scopeComputed(route);
  const windowS = scopeWindowS(route, sources);
  // historia: búfer circular intercalado [señal, resultado]
  const history = useSharedValue<number[]>(new Array(N * 2).fill(0));
  const head = useSharedValue(0);
  const filled = useSharedValue(false);
  // lo que se dibuja, de la muestra más vieja a la actual, intercalado [señal, resultado]
  const shown = useSharedValue<number[]>(new Array(N * 2).fill(0));

  useFrameCallback((info) => {
    const bus = live?.bus;
    const t = bus ? bus.time.get() : info.timeSinceFirstFrame / 1000;
    const rec = bus ? recInput(bus) : null;
    const inputs: ModInputs = {
      touch: {},
      gateOnAt: bus ? bus.gateOn.get() : null,
      gateOffAt: bus ? bus.gateOff.get() : null,
      orientation: bus ? oriInput(bus) : { x: 0, y: 0 },
      mic: live ? live.micLevel.get() : 0,
      micHitAt: bus ? bus.micHitAt.get() : null,
      track: null,
      rec,
    };
    const seed = live ? live.seed : 0;
    const ownSeed = seed + Math.max(0, index) * 7919;
    const signalAt = (tt: number, inp: ModInputs) => {
      const v = sourceValue(route, sources, tt, inp, ownSeed, base);
      return Math.min(1, Math.max(0, bipolar ? (v + 1) / 2 : v));
    };

    // la historia se graba siempre (así cambiar de modo no la deja vacía)
    const s = signalAt(t, inputs);
    const r = evaluateAxis(route.target.layerId, route.target.param, base, routes, sources, t, inputs, seed);
    const i = head.get();
    history.modify((b) => {
      "worklet";
      if (!filled.get()) {
        for (let k = 0; k < N; k++) {
          b[k * 2] = s;
          b[k * 2 + 1] = r;
        }
      }
      b[i * 2] = s;
      b[i * 2 + 1] = r;
      return b;
    });
    filled.set(true);
    head.set((i + 1) % N);

    const recording = rec !== null && rec.routeId === route.id;
    const calc = computed && !recording && !adsrActive(route, sources, t, inputs, windowS);
    shown.modify((out) => {
      "worklet";
      if (calc) {
        for (let k = 0; k < N; k++) {
          const tk = t - windowS + (k / (N - 1)) * windowS;
          const inp = previewInputs(route, sources, tk, inputs);
          out[k * 2] = signalAt(tk, inp);
          out[k * 2 + 1] = evaluateAxis(route.target.layerId, route.target.param, base, routes, sources, tk, inp, seed);
        }
      } else {
        const b = history.get();
        const h0 = head.get();
        for (let k = 0; k < N; k++) {
          const idx = (h0 + k) % N;
          out[k * 2] = b[idx * 2];
          out[k * 2 + 1] = b[idx * 2 + 1];
        }
      }
      return out;
    });
  });

  const h = height - PAD * 2;
  const toPoints = (track: 0 | 1) => {
    "worklet";
    const b = shown.get();
    const out = [];
    for (let k = 0; k < N; k++) out.push({ x: (k / (N - 1)) * (width - 6), y: PAD + (1 - b[k * 2 + track]) * h });
    return out;
  };
  const signalPts = useDerivedValue(() => toPoints(0));
  const resultPts = useDerivedValue(() => toPoints(1));
  const dotY = useDerivedValue(() => PAD + (1 - shown.get()[(N - 1) * 2]) * h);
  const resultDotY = useDerivedValue(() => PAD + (1 - shown.get()[(N - 1) * 2 + 1]) * h);
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
