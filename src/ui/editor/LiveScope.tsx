import { Canvas, Circle, Group, Line, Points, rect, vec } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { useAnimatedReaction, useDerivedValue, useSharedValue } from "react-native-reanimated";

import { recInput, useLiveMod, type ModBus } from "../../canvas/modBus";
import type { Route, SourceConfig } from "../../domain/types";
import { evaluateAxis, type ModInputs } from "../../modulation/evaluate";
import { adsrActive, LIVE_WINDOW_S, previewInputs, scopeComputed, scopeWindowS } from "../../modulation/scopeWindow";
import { colors } from "../tokens";

// puntos de la curva
const N = 90;
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

// lo que necesita el hilo de UI para dibujar; version cambia con cada ajuste
type ScopeConfig = {
  route: Route;
  routes: readonly Route[];
  sources: SourceConfig;
  base: { x: number; y: number };
  seed: number;
  computed: boolean;
  sweepS: number;
  version: number;
};

// entradas en vivo del instante (dedo, micrófono, grabación)
function readInputs(bus: ModBus | undefined, mic: number): ModInputs {
  "worklet";
  return {
    touch: {},
    gateOnAt: bus ? bus.gateOn.get() : null,
    gateOffAt: bus ? bus.gateOff.get() : null,
    mic,
    micHitAt: bus ? bus.micHitAt.get() : null,
    track: null,
    rec: bus ? recInput(bus) : null,
  };
}

// valor del parámetro del efecto en t (0..1)
function valueAt(c: ScopeConfig, t: number, inputs: ModInputs): number {
  "worklet";
  return evaluateAxis(c.route.target.layerId, c.route.target.param, c.base, c.routes, c.sources, t, inputs, c.seed);
}

// gráfica en vivo de una modulación: cómo se mueve el parámetro del efecto, como un barrido. La
// curva queda quieta y una bolita la recorre de izquierda a derecha al ritmo real; lo ya recorrido
// brilla y lo que viene se ve tenue. Lo que depende solo del tiempo (LFO, pasos, pulso, gesto, ADSR
// de muestra) se calcula entero; lo que depende de ti o del azar lo va dibujando la bolita.
//
// Rendimiento: corre en el hilo de UI, junto al efecto. La animación se crea una vez al montar (los
// ajustes le llegan por un valor compartido, sin rehacerla en cada movimiento del deslizador) y la
// curva se recalcula solo al empezar una vuelta o al cambiar un ajuste; en cada cuadro solo se
// mueve la bolita
export function LiveScope({ route, routes, sources, base, width, height }: Props) {
  const live = useLiveMod();
  const bus = live?.bus;
  const noMic = useSharedValue(0);
  const micLevel = live ? live.micLevel : noMic;
  const noClock = useSharedValue(0);
  const clock = bus ? bus.time : noClock;
  const seed = live ? live.seed : 0;

  const make = (version: number): ScopeConfig => ({
    route,
    routes,
    sources,
    base,
    seed,
    computed: scopeComputed(route, sources),
    sweepS: scopeWindowS(route, sources),
    version,
  });
  const cfg = useSharedValue<ScopeConfig>(make(0));
  const version = useSharedValue(0);
  useEffect(() => {
    const v = version.get() + 1;
    version.set(v);
    cfg.set(make(v));
    // make lee estas mismas props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, routes, sources, base, seed, cfg, version]);

  // curva a dibujar (N valores 0..1) y la bolita
  const curve = useSharedValue<number[]>(new Array(N).fill(0));
  const ball = useSharedValue({ u: 0, v: 0 });
  // barrido en vivo y lo último calculado (para no repetir trabajo)
  const trace = useSharedValue<number[]>(new Array(N).fill(0));
  const memo = useSharedValue({ version: -1, start: -1, calc: false, slot: -1 });

  useAnimatedReaction(
    () => clock.get(),
    (t) => {
      const c = cfg.get();
      const inputs = readInputs(bus, micLevel.get());
      const recording = inputs.rec !== null && inputs.rec.routeId === c.route.id;
      const adsrLive = adsrActive(c.route, c.sources, t, inputs, LIVE_WINDOW_S);
      const calc = c.computed && !recording && !adsrLive;
      // el ADSR que estás disparando usa el barrido en vivo; el azar, su propia ventana
      const w = calc || !adsrLive ? c.sweepS : LIVE_WINDOW_S;
      const start = Math.floor(t / w) * w;
      const u = (t - start) / w;
      const m = memo.get();
      const changed = m.version !== c.version;

      // barrido en vivo: se escribe siempre (al pasar a en vivo no queda vacío); con un ajuste
      // nuevo o la primera vez, empieza como línea plana en el valor actual
      const v = valueAt(c, t, inputs);
      const slot = Math.min(N - 1, Math.floor(u * N));
      trace.modify((b) => {
        "worklet";
        if (changed || m.slot < 0) {
          for (let k = 0; k < N; k++) b[k] = v;
        } else {
          // rellena las columnas que el cuadro saltó (sin huecos)
          let k = m.slot === slot ? slot : (m.slot + 1) % N;
          for (let guard = 0; guard < N; guard++) {
            b[k] = v;
            if (k === slot) break;
            k = (k + 1) % N;
          }
        }
        return b;
      });

      if (calc) {
        // la curva calculada solo cambia al empezar una vuelta o con un ajuste nuevo
        if (changed || !m.calc || m.start !== start) {
          const out = new Array<number>(N);
          for (let k = 0; k < N; k++) {
            const tk = start + (k / (N - 1)) * w;
            out[k] = valueAt(c, tk, previewInputs(c.route, c.sources, tk, inputs));
          }
          curve.set(out);
        }
      } else if (changed || m.calc || m.slot !== slot) {
        curve.set(trace.get().slice());
      }
      memo.set({ version: c.version, start, calc, slot });
      // la bolita marca el valor de este instante (en el ADSR de muestra, el del disparo de muestra)
      ball.set({ u, v: calc ? valueAt(c, t, previewInputs(c.route, c.sources, t, inputs)) : v });
    },
    // sin lista de dependencias: en iOS se ignora (Reanimated avisa en cada render). La reacción
    // solo usa valores compartidos estables; los ajustes le llegan por cfg
  );

  const h = height - PAD * 2;
  const span = width - PAD_X * 2;
  // la curva solo se rehace cuando cambia (no en cada cuadro); el tramo brillante es la misma curva
  // recortada hasta la bolita
  const points = useDerivedValue(() => {
    const b = curve.get();
    const out = [];
    for (let k = 0; k < N; k++) out.push({ x: PAD_X + (k / (N - 1)) * span, y: PAD + (1 - b[k]) * h });
    return out;
  });
  const ballX = useDerivedValue(() => PAD_X + ball.get().u * span);
  const ballY = useDerivedValue(() => PAD + (1 - ball.get().v) * h);
  const behind = useDerivedValue(() => rect(0, 0, ballX.get(), height));
  const headTop = useDerivedValue(() => vec(ballX.get(), 0));
  const headBottom = useDerivedValue(() => vec(ballX.get(), height));

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Points points={points} mode="polygon" color={colors.inkText} strokeWidth={2} style="stroke" strokeJoin="round" opacity={0.3} />
      <Group clip={behind}>
        <Points points={points} mode="polygon" color={colors.inkText} strokeWidth={2} style="stroke" strokeJoin="round" />
      </Group>
      {/* cabezal: dónde va el barrido */}
      <Line p1={headTop} p2={headBottom} color={colors.inkLine} strokeWidth={1} />
      <Circle cx={ballX} cy={ballY} r={BALL_R} color={colors.inkText} />
    </Canvas>
  );
}
