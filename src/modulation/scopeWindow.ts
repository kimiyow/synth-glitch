import type { Route, SourceConfig } from "../domain/types";
import { MIC_HIT_GATE_S, type ModInputs } from "./evaluate";
import { cycleHz, gesturePeriodS, routeLfo, routeSeq, routeSh } from "./sources";

// ventana de la gráfica en vivo de una modulación. Las fuentes que dependen solo del tiempo se
// dibujan calculadas (la curva completa desde el primer cuadro y al instante al cambiar un ajuste);
// las que dependen de ti (micrófono, giro) muestran lo que pasó en los últimos segundos

const MIN_S = 2;
const MAX_S = 8;
// ADSR de muestra: cuánto se mantiene apretado y la pausa antes del siguiente disparo
const PREVIEW_HOLD_S = 0.5;
const PREVIEW_GAP_S = 0.3;

const clampWindow = (s: number) => {
  "worklet";
  return Math.min(MAX_S, Math.max(MIN_S, s));
};

// true si la curva se puede calcular para cualquier instante (no depende de entradas en vivo)
export function scopeComputed(route: Route): boolean {
  "worklet";
  const s = route.source;
  if (s === "lfo" || s === "sh" || s === "seq" || s === "tempo" || s === "adsr") return true;
  if (s === "track") {
    const g = route.settings === undefined ? undefined : route.settings.gesture;
    return g !== undefined && g.samples.length >= 4 && g.durationMs > 0;
  }
  return false;
}

function adsrCfg(route: Route, sources: SourceConfig) {
  "worklet";
  const own = route.settings === undefined ? undefined : route.settings.adsr;
  return own === undefined ? { ...sources.adsr, trigger: "touch" as const } : own;
}

// un ciclo del ADSR de muestra: sube, cae, se mantiene, se suelta y descansa
function adsrCycle(route: Route, sources: SourceConfig): { hold: number; cycle: number } {
  "worklet";
  const a = adsrCfg(route, sources);
  const hold = a.trigger === "mic" ? MIC_HIT_GATE_S : a.attack + a.decay + PREVIEW_HOLD_S;
  return { hold, cycle: hold + a.release + PREVIEW_GAP_S };
}

// segundos que muestra la gráfica: unos dos ciclos de la señal, entre 2 y 8 s
export function scopeWindowS(route: Route, sources: SourceConfig): number {
  "worklet";
  const beat = 60 / sources.tempo.bpm;
  switch (route.source) {
    case "lfo": {
      const l = routeLfo(route, sources);
      return clampWindow(2 / Math.max(0.01, cycleHz(l.rateHz, l.sync, l.division, sources.tempo.bpm)));
    }
    case "sh":
      return clampWindow(4 * routeSh(route, sources).division * beat);
    case "seq": {
      const q = routeSeq(route, sources);
      return clampWindow(q.steps.length * q.division * beat);
    }
    case "tempo":
      return clampWindow(4 * beat);
    case "adsr":
      return clampWindow(2 * adsrCycle(route, sources).cycle);
    case "track": {
      const g = route.settings === undefined ? undefined : route.settings.gesture;
      return g === undefined ? MIN_S : clampWindow(gesturePeriodS(g));
    }
    default:
      return MIN_S;
  }
}

// el ADSR real se está usando (dedo o golpe del micrófono en la ventana): se muestra lo que pasó
export function adsrActive(route: Route, sources: SourceConfig, t: number, inputs: ModInputs, windowS: number): boolean {
  "worklet";
  if (route.source !== "adsr") return false;
  if (adsrCfg(route, sources).trigger === "mic") return inputs.micHitAt !== null && t - inputs.micHitAt < windowS;
  const on = inputs.gateOnAt;
  if (on === null) return false;
  const off = inputs.gateOffAt;
  return (off === null || off < on) || t - on < windowS;
}

// entradas para dibujar el ADSR de muestra en el instante t: disparos periódicos
export function previewInputs(route: Route, sources: SourceConfig, t: number, inputs: ModInputs): ModInputs {
  "worklet";
  if (route.source !== "adsr") return inputs;
  const { hold, cycle } = adsrCycle(route, sources);
  const local = ((t % cycle) + cycle) % cycle;
  const on = t - local;
  if (adsrCfg(route, sources).trigger === "mic") return { ...inputs, micHitAt: on };
  return { ...inputs, gateOnAt: on, gateOffAt: on + hold };
}
