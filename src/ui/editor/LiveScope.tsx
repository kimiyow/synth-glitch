import { Canvas, Circle, Line, Points, vec } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { useAnimatedReaction, useDerivedValue, useSharedValue } from "react-native-reanimated";

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
  const computed = scopeComputed(route, sources);
  const sweepS = scopeWindowS(route, sources);
  // reloj del editor (lo avanza el lienzo en cada cuadro). Todo lo que se dibuja sale de un solo
  // valor derivado que lee el reloj en su propio cuerpo, como la estela del gesto: así se dibuja
  // desde el primer cuadro al montar y se rehace con cada ajuste (Reanimated solo sigue los valores
  // compartidos que lee el cuerpo, no los leídos dentro de funciones auxiliares)
  const noClock = useSharedValue(0);
  const clock = live ? live.bus.time : noClock;
  // barrido en vivo (micrófono, giro, azar, ADSR en uso): intercalado [señal, resultado] por columna
  const trace = useSharedValue<number[]>(new Array(N * 2).fill(0));
  const lastSlot = useSharedValue(-1);

  // valores de un instante. Las entradas en vivo se leen aquí sin suscribirse: el reloj ya marca
  // cada cuadro
  const sample = (t: number, inputs: ModInputs) => {
    "worklet";
    const seed = live ? live.seed : 0;
    const v = sourceValue(route, sources, t, inputs, seed + Math.max(0, index) * 7919, base);
    return {
      s: Math.min(1, Math.max(0, bipolar ? (v + 1) / 2 : v)),
      r: evaluateAxis(route.target.layerId, route.target.param, base, routes, sources, t, inputs, seed),
    };
  };
  const readInputs = (): ModInputs => {
    "worklet";
    const bus = live?.bus;
    return {
      touch: {},
      gateOnAt: bus ? bus.gateOn.get() : null,
      gateOffAt: bus ? bus.gateOff.get() : null,
      orientation: bus ? oriInput(bus) : { x: 0, y: 0 },
      mic: live ? live.micLevel.get() : 0,
      micHitAt: bus ? bus.micHitAt.get() : null,
      track: null,
      rec: bus ? recInput(bus) : null,
    };
  };
  // modo del barrido en t: calculado (curva entera) o en vivo, y su ventana
  const modeAt = (t: number, inputs: ModInputs) => {
    "worklet";
    const recording = inputs.rec !== null && inputs.rec.routeId === route.id;
    const adsrLive = adsrActive(route, sources, t, inputs, LIVE_WINDOW_S);
    const calc = computed && !recording && !adsrLive;
    // el ADSR que estás disparando usa el barrido en vivo; el azar, su propia ventana (unos pasos)
    const w = calc || !adsrLive ? sweepS : LIVE_WINDOW_S;
    const start = Math.floor(t / w) * w;
    return { calc, w, start, u: (t - start) / w };
  };

  // el barrido en vivo se escribe en cada cuadro (al pasar de calculado a en vivo no queda vacío). La
  // primera vez se llena con el valor actual: una línea plana, nunca una gráfica vacía
  useAnimatedReaction(
    () => clock.get(),
    (t) => {
      const inputs = readInputs();
      const { u } = modeAt(t, inputs);
      const { s, r } = sample(t, inputs);
      const slot = Math.min(N - 1, Math.floor(u * N));
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
    },
    [route, routes, sources, base, index, bipolar, computed, sweepS, live],
  );
  // al cambiar un ajuste, el trazo en vivo empieza de nuevo desde el valor actual: no queda a la
  // vista la vuelta anterior con los ajustes viejos
  useEffect(() => {
    lastSlot.set(-1);
  }, [route, routes, sources, base, lastSlot]);

  // el cuadro que se dibuja: curva [señal, resultado] y la bolita (posición 0..1 y sus valores)
  const scope = useDerivedValue(() => {
    const t = clock.get();
    const traced = trace.get();
    const inputs = readInputs();
    const m = modeAt(t, inputs);
    const curve = new Array<number>(N * 2);
    if (m.calc) {
      for (let k = 0; k < N; k++) {
        const tk = m.start + (k / (N - 1)) * m.w;
        const v = sample(tk, previewInputs(route, sources, tk, inputs));
        curve[k * 2] = v.s;
        curve[k * 2 + 1] = v.r;
      }
    } else {
      for (let k = 0; k < N * 2; k++) curve[k] = traced[k];
    }
    // la bolita marca el valor de este instante (en el ADSR de muestra, el del disparo de muestra)
    const now = sample(t, m.calc ? previewInputs(route, sources, t, inputs) : inputs);
    return { curve, u: m.u, s: now.s, r: now.r };
  });

  const h = height - PAD * 2;
  const span = width - PAD_X * 2;
  // tramo de una pista: hasta la bolita (behind) o desde ella (ahead). Recibe valores ya leídos
  const toPoints = (b: number[], u: number, track: 0 | 1, part: "all" | "behind" | "ahead") => {
    "worklet";
    const cut = Math.round(u * (N - 1));
    const from = part === "ahead" ? cut : 0;
    const to = part === "behind" ? cut : N - 1;
    const out = [];
    for (let k = from; k <= to; k++) out.push({ x: PAD_X + (k / (N - 1)) * span, y: PAD + (1 - b[k * 2 + track]) * h });
    return out;
  };
  // se dibuja solo cómo se mueve el parámetro del efecto (lo que se ve en la imagen): la intensidad
  // agranda o achica la onda y en negativo la invierte, sin una segunda línea que explicar
  const behindPts = useDerivedValue(() => {
    const f = scope.get();
    return toPoints(f.curve, f.u, 1, "behind");
  });
  const aheadPts = useDerivedValue(() => {
    const f = scope.get();
    return toPoints(f.curve, f.u, 1, "ahead");
  });
  const ballX = useDerivedValue(() => PAD_X + scope.get().u * span);
  const ballY = useDerivedValue(() => PAD + (1 - scope.get().r) * h);
  const headTop = useDerivedValue(() => vec(ballX.get(), 0));
  const headBottom = useDerivedValue(() => vec(ballX.get(), height));

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Points points={aheadPts} mode="polygon" color={colors.inkText} strokeWidth={2} style="stroke" strokeJoin="round" opacity={0.3} />
      <Points points={behindPts} mode="polygon" color={colors.inkText} strokeWidth={2} style="stroke" strokeJoin="round" />
      {/* cabezal: dónde va el barrido */}
      <Line p1={headTop} p2={headBottom} color={colors.inkLine} strokeWidth={1} />
      <Circle cx={ballX} cy={ballY} r={BALL_R} color={colors.inkText} />
    </Canvas>
  );
}
