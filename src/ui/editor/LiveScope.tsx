import { Canvas, Circle, Line, Points, vec } from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

import { oriInput, recInput, useLiveMod } from "../../canvas/modBus";
import type { Route, SourceConfig } from "../../domain/types";
import { evaluateAxis, sourceValue, type ModInputs } from "../../modulation/evaluate";
import { adsrActive, LIVE_WINDOW_S, previewInputs, scopeComputed, scopeWindowS } from "../../modulation/scopeWindow";
import { colors } from "../tokens";

// muestras por barrido
const N = 120;
const PAD = 4;
// margen lateral: la bolita cabe entera en los extremos
const PAD_X = 6;
const BALL_R = 5;

type Props = {
  route: Route;
  // todas las rutas de la escena: el resultado suma todas las modulaciones del parámetro
  routes: readonly Route[];
  sources: SourceConfig;
  base: { x: number; y: number };
  width: number;
  height: number;
};

// gráfica en vivo de una modulación como un barrido: la curva queda quieta y una bolita la recorre
// de izquierda a derecha al ritmo real; al llegar al final vuelve a empezar. Lo ya recorrido se ve
// brillante y lo que viene, tenue. Blanco = la señal de la fuente; gris = el valor que toma el
// parámetro con todas sus modulaciones.
// Si la señal depende solo del tiempo (LFO, azar, pasos, pulso, gesto grabado, ADSR de muestra) la
// curva se calcula entera: el barrido dura un número entero de ciclos, así cada vuelta se ve igual,
// y cambia al instante con cada ajuste. Micrófono, giro y el ADSR que estás disparando no se pueden
// prever: la bolita va dibujando lo que pasa y lo de delante es la vuelta anterior
export function LiveScope({ route, routes, sources, base, width, height }: Props) {
  const live = useLiveMod();
  const index = routes.findIndex((r) => r.id === route.id);
  const bipolar = route.source === "lfo" || route.source === "sh" || route.source === "orientation";
  const computed = scopeComputed(route);
  const sweepS = scopeWindowS(route, sources);
  // barrido en vivo: intercalado [señal, resultado] por columna
  const trace = useSharedValue<number[]>(new Array(N * 2).fill(0));
  const lastSlot = useSharedValue(-1);
  // lo que se dibuja, intercalado [señal, resultado], y la posición de la bolita (0..1) y sus valores
  const shown = useSharedValue<number[]>(new Array(N * 2).fill(0));
  const ball = useSharedValue({ u: 0, s: 0, r: 0 });

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
    const resultAt = (tt: number, inp: ModInputs) => evaluateAxis(route.target.layerId, route.target.param, base, routes, sources, tt, inp, seed);

    const recording = rec !== null && rec.routeId === route.id;
    const calc = computed && !recording && !adsrActive(route, sources, t, inputs, LIVE_WINDOW_S);
    const w = calc ? sweepS : LIVE_WINDOW_S;
    const start = Math.floor(t / w) * w;
    const u = (t - start) / w;

    // el barrido en vivo se escribe siempre (al pasar de calculado a en vivo no queda vacío). La
    // primera vez se llena con el valor actual: una línea plana, nunca una gráfica vacía
    const s = signalAt(t, inputs);
    const r = resultAt(t, inputs);
    const slot = Math.min(N - 1, Math.floor((t / LIVE_WINDOW_S - Math.floor(t / LIVE_WINDOW_S)) * N));
    const prev = lastSlot.get();
    trace.modify((b) => {
      "worklet";
      if (prev < 0) {
        for (let k = 0; k < N; k++) {
          b[k * 2] = s;
          b[k * 2 + 1] = r;
        }
      } else {
        // rellena las columnas que el cuadro saltó (sin huecos); al dar la vuelta, desde el inicio
        let k = prev === slot ? slot : (prev + 1) % N;
        for (let guard = 0; guard < N; guard++) {
          b[k * 2] = s;
          b[k * 2 + 1] = r;
          if (k === slot) break;
          k = (k + 1) % N;
        }
      }
      return b;
    });
    lastSlot.set(slot);

    shown.modify((out) => {
      "worklet";
      if (calc) {
        for (let k = 0; k < N; k++) {
          const tk = start + (k / (N - 1)) * w;
          const inp = previewInputs(route, sources, tk, inputs);
          out[k * 2] = signalAt(tk, inp);
          out[k * 2 + 1] = resultAt(tk, inp);
        }
      } else {
        const b = trace.get();
        for (let k = 0; k < N * 2; k++) out[k] = b[k];
      }
      return out;
    });
    // la bolita marca el valor de este instante (en el ADSR de muestra, el del disparo de muestra)
    const inpNow = calc ? previewInputs(route, sources, t, inputs) : inputs;
    ball.set({ u, s: calc ? signalAt(t, inpNow) : s, r: calc ? resultAt(t, inpNow) : r });
  });

  const h = height - PAD * 2;
  const span = width - PAD_X * 2;
  const xAt = (k: number) => {
    "worklet";
    return PAD_X + (k / (N - 1)) * span;
  };
  // tramo de una pista: hasta la bolita (behind) o desde ella (ahead)
  const toPoints = (track: 0 | 1, part: "all" | "behind" | "ahead") => {
    "worklet";
    const b = shown.get();
    const cut = Math.round(ball.get().u * (N - 1));
    const from = part === "ahead" ? cut : 0;
    const to = part === "behind" ? cut : N - 1;
    const out = [];
    for (let k = from; k <= to; k++) out.push({ x: xAt(k), y: PAD + (1 - b[k * 2 + track]) * h });
    return out;
  };
  const resultPts = useDerivedValue(() => toPoints(1, "all"));
  const behindPts = useDerivedValue(() => toPoints(0, "behind"));
  const aheadPts = useDerivedValue(() => toPoints(0, "ahead"));
  const ballX = useDerivedValue(() => PAD_X + ball.get().u * span);
  const ballY = useDerivedValue(() => PAD + (1 - ball.get().s) * h);
  const resultY = useDerivedValue(() => PAD + (1 - ball.get().r) * h);
  const headTop = useDerivedValue(() => vec(ballX.get(), 0));
  const headBottom = useDerivedValue(() => vec(ballX.get(), height));
  const mid = bipolar ? PAD + h / 2 : PAD + h;

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Line p1={vec(0, mid)} p2={vec(width, mid)} color={colors.inkLine} strokeWidth={1} />
      <Points points={resultPts} mode="polygon" color={colors.inkMute} strokeWidth={1.5} style="stroke" opacity={0.7} />
      <Points points={aheadPts} mode="polygon" color={colors.inkText} strokeWidth={2} style="stroke" strokeJoin="round" opacity={0.3} />
      <Points points={behindPts} mode="polygon" color={colors.inkText} strokeWidth={2} style="stroke" strokeJoin="round" />
      {/* cabezal: dónde va el barrido */}
      <Line p1={headTop} p2={headBottom} color={colors.inkLine} strokeWidth={1} />
      <Circle cx={ballX} cy={resultY} r={3} color={colors.inkMute} />
      <Circle cx={ballX} cy={ballY} r={BALL_R} color={colors.inkText} />
    </Canvas>
  );
}
