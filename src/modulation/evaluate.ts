import type { Layer, Route, SourceConfig } from "../domain/types";
import { curve01, curveSigned } from "./curves";
import { adsrValue, lfoValue, routeLfo, routeSeq, routeSh, seqValue, shValue } from "./sources";
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
};

export const NO_INPUTS: ModInputs = {
  touch: {},
  gateOnAt: null,
  gateOffAt: null,
  orientation: { x: 0, y: 0 },
  mic: 0,
  micHitAt: null,
  track: null,
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
      const v = route.target.param === "x" ? inputs.orientation.x : inputs.orientation.y;
      return Math.max(-1, Math.min(1, v * sources.orientation.sensitivity));
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
  let add = 0;
  let replace = 0;
  let hasReplace = false;
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    if (r.target.layerId !== layerId || r.target.param !== param) continue;
    // cada ruta tiene su propio azar: dos S&H en capas distintas no se mueven igual
    const v = sourceValue(r, sources, t, inputs, seed + i * 7919, base);
    if (r.mode === "replace") {
      hasReplace = true;
      const u = isBipolar(r.source) ? (v + 1) / 2 : v;
      replace += r.amount * curve01(r.curve, u);
    } else {
      add += r.amount * (isBipolar(r.source) ? curveSigned(r.curve, v) : curve01(r.curve, v));
    }
  }
  const b = param === "x" ? base.x : base.y;
  return Math.min(1, Math.max(0, (hasReplace ? replace : b) + add));
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
