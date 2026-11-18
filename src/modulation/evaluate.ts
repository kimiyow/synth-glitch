import type { Layer, Route, SourceConfig } from "../domain/types";
import { curve01, curveSigned } from "./curves";
import { shapeTilt } from "./orientation";
import { adsrValue, gestureValue, lfoValue, routeLfo, routeSeq, routeSh, seqValue, shValue } from "./sources";
import { beatPhase } from "./tempo";

// entradas en vivo del cuadro (no se guardan en el proyecto)
export type ModInputs = {
  // valor base del gesto X/Y por capa (si el dedo está ajustando); si no, layer.params
  touch: Record<string, { x: number; y: number }>;
  // dedo apoyado / levantado (s) para el ADSR
  gateOnAt: number | null;
  gateOffAt: number | null;
  // inclinación filtrada y calibrada, -1..1
  orientation: { x: number; y: number };
  // nivel del micrófono 0..1 y momento (s) del último golpe
  mic: number;
  micHitAt: number | null;
  // pista gestual activa: muestras [x, y] intercaladas, duración e inicio de reproducción (s)
  track: { samples: number[]; durationMs: number; startAt: number } | null;
  // grabación de un gesto en curso: la ruta que se graba sigue al dedo en vivo
  rec: { routeId: string; x: number; y: number } | null;
};

export const NO_INPUTS: ModInputs = {
  touch: {},
  gateOnAt: null,
  gateOffAt: null,
  orientation: { x: 0, y: 0 },
  mic: 0,
  micHitAt: null,
  track: null,
  rec: null,
};

// duración de la compuerta del ADSR cuando lo dispara un golpe del micrófono
export const MIC_HIT_GATE_S = 0.12;

// fuentes bipolares: en modo suma mueven el parámetro hacia ambos lados
function isBipolar(source: Route["source"]): boolean {
  "worklet";
  return source === "lfo" || source === "sh" || source === "orientation";
}

// valor de una fuente en t (s)
export function sourceValue(
  route: Route,
  sources: SourceConfig,
  t: number,
  inputs: ModInputs,
  seed: number,
  base: { x: number; y: number },
  // eje que se evalúa (el gesto mueve los dos con una sola ruta)
  param: "x" | "y" = route.target.param,
): number {
  "worklet";
  const bpm = sources.tempo.bpm;
  switch (route.source) {
    case "lfo":
      return lfoValue(routeLfo(route, sources), bpm, t, seed);
    case "adsr": {
      const own = route.settings === undefined ? undefined : route.settings.adsr;
      const cfg = own === undefined ? sources.adsr : own;
      if (own !== undefined && own.trigger === "mic") {
        const at = inputs.micHitAt;
        return adsrValue(cfg, t, at, at === null ? null : at + MIC_HIT_GATE_S);
      }
      return adsrValue(cfg, t, inputs.gateOnAt, inputs.gateOffAt);
    }
    case "sh":
      return shValue(routeSh(route, sources), bpm, t, seed);
    case "seq":
      return seqValue(routeSeq(route, sources), bpm, t, seed);
    case "tempo":
      return beatPhase(bpm, t);
    case "orientation": {
      // GIRO mueve los dos ejes: lateral → x, frontal → y (o cruzados)
      const own = route.settings === undefined ? undefined : route.settings.orientation;
      const o = own === undefined ? sources.orientation : own;
      const lateral = o.swapAxes ? param === "y" : param === "x";
      return shapeTilt(lateral ? inputs.orientation.x : inputs.orientation.y, o.deadzone, o.sensitivity);
    }
    case "mic": {
      const m = route.settings === undefined ? undefined : route.settings.mic;
      if (m === undefined) return inputs.mic;
      if (m.mode === "hit") {
        const at = inputs.micHitAt;
        if (at === null || t < at) return 0;
        return Math.max(0, 1 - (t - at) / Math.max(m.decay, 1e-3));
      }
      return Math.min(1, inputs.mic * m.gain);
    }
    case "track": {
      const rec = inputs.rec;
      if (rec !== null && rec.routeId === route.id) return param === "x" ? rec.x : rec.y;
      const g = route.settings === undefined ? undefined : route.settings.gesture;
      if (g !== undefined) {
        const v = gestureValue(g, t, param === "x" ? 0 : 1);
        return v === null ? (param === "x" ? base.x : base.y) : v;
      }
      const tr = inputs.track;
      if (!tr || tr.samples.length < 2 || tr.durationMs <= 0) return route.target.param === "x" ? base.x : base.y;
      const frames = tr.samples.length / 2;
      const local = ((t - tr.startAt) * 1000) % tr.durationMs;
      const i = Math.min(frames - 1, Math.max(0, Math.floor((local / tr.durationMs) * frames)));
      return tr.samples[i * 2 + (route.target.param === "x" ? 0 : 1)];
    }
    default: // touch
      return route.target.param === "x" ? base.x : base.y;
  }
}

// valor efectivo de un eje: clamp(base ⊕ Σ amount · curve(fuente)). Con alguna ruta en modo
// reemplazo, la base se sustituye por la suma de esas rutas
export function evaluateAxis(
  layerId: string,
  param: "x" | "y",
  base: { x: number; y: number },
  routes: readonly Route[],
  sources: SourceConfig,
  t: number,
  inputs: ModInputs,
  seed: number,
): number {
  "worklet";
  const b = param === "x" ? base.x : base.y;
  let add = 0;
  // reemplazo: cada ruta lleva el valor desde la base hacia su fuente según su intensidad
  // (1 = la fuente manda; 0.5 = a mitad de camino; 0 = la base)
  let pull = 0;
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    // el gesto y el giro mueven los dos ejes de su capa
    if (r.target.layerId !== layerId || (r.target.param !== param && r.source !== "track" && r.source !== "orientation")) continue;
    // cada ruta tiene su propio azar: dos S&H en capas distintas no se mueven igual
    const v = sourceValue(r, sources, t, inputs, seed + i * 7919, base, param);
    if (r.mode === "replace") {
      const u = isBipolar(r.source) ? (v + 1) / 2 : v;
      pull += r.amount * (curve01(r.curve, u) - b);
    } else {
      add += r.amount * (isBipolar(r.source) ? curveSigned(r.curve, v) : curve01(r.curve, v));
    }
  }
  return Math.min(1, Math.max(0, b + pull + add));
}

// evaluate(escena, t, entradas): parámetros efectivos intercalados [x, y] de las capas dadas, en
// orden. Función pura y worklet: mismo t, entradas y semilla → mismo resultado
export function evaluate(
  layers: readonly Pick<Layer, "id" | "params">[],
  routes: readonly Route[],
  sources: SourceConfig,
  t: number,
  inputs: ModInputs,
  seed: number,
): number[] {
  "worklet";
  const out: number[] = [];
  for (const layer of layers) {
    const base = inputs.touch[layer.id] ?? layer.params;
    out.push(evaluateAxis(layer.id, "x", base, routes, sources, t, inputs, seed));
    out.push(evaluateAxis(layer.id, "y", base, routes, sources, t, inputs, seed));
  }
  return out;
}
