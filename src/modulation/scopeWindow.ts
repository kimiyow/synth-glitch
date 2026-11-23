import type { Route, SourceConfig } from "../domain/types";
import { MIC_HIT_GATE_S, type ModInputs } from "./evaluate";
import { cycleHz, gesturePeriodS, routeLfo, routeSeq, routeSh } from "./sources";

// ventana de la gráfica en vivo de una modulación. Las fuentes que dependen solo del tiempo se
// dibujan calculadas (la curva completa desde el primer cuadro y al instante al cambiar un ajuste);
// las que dependen de ti (micrófono, giro) muestran lo que pasó en los últimos segundos

// ADSR de muestra: cuánto se mantiene apretado y la pausa antes del siguiente disparo
const PREVIEW_HOLD_S = 0.5;
const PREVIEW_GAP_S = 0.3;

// true si la curva se dibuja calculada entera (se repite igual en cada vuelta). Lo que es al azar
// (AZAR, LFO aleatorio, pasos en orden aleatorio) cambia en cada vuelta: la bolita lo va dibujando
// según sale, como el micrófono, en lugar de mostrar de golpe valores que aún no ocurren
export function scopeComputed(route: Route, sources: SourceConfig): boolean {
  "worklet";
  const s = route.source;
  if (s === "lfo") return routeLfo(route, sources).shape !== "random";
  if (s === "seq") return routeSeq(route, sources).direction !== "random";
  if (s === "tempo" || s === "adsr") return true;
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

// barrido de las fuentes en vivo (micrófono, giro, ADSR en uso)
export const LIVE_WINDOW_S = 3;
// ventana mínima y máxima de un barrido calculado
const SWEEP_MIN_S = 1.5;
const SWEEP_MAX_S = 12;

// ventana para una señal de periodo p: un número entero de ciclos (así cada barrido se ve igual y la
// bolita recorre siempre la misma curva), al menos 1.5 s; un ciclo muy largo se corta a 12 s
function periodWindow(p: number): number {
  "worklet";
  if (!(p > 0)) return LIVE_WINDOW_S;
  if (p >= SWEEP_MAX_S) return SWEEP_MAX_S;
  return p * Math.max(1, Math.ceil(SWEEP_MIN_S / p));
}

// segundos de un barrido de la gráfica. Los barridos empiezan en múltiplos de la ventana, alineados
// con el reloj (los ciclos de LFO, pasos, pulso y gesto también arrancan en t = 0)
export function scopeWindowS(route: Route, sources: SourceConfig): number {
  "worklet";
  const beat = 60 / sources.tempo.bpm;
  switch (route.source) {
    case "lfo": {
      const l = routeLfo(route, sources);
      return periodWindow(1 / Math.max(0.01, cycleHz(l.rateHz, l.sync, l.division, sources.tempo.bpm)));
    }
    case "sh":
      return periodWindow(4 * routeSh(route, sources).division * beat);
    case "seq": {
      const q = routeSeq(route, sources);
      const steps = q.direction === "pingpong" ? Math.max(1, 2 * q.steps.length - 2) : q.steps.length;
      return periodWindow(steps * q.division * beat);
    }
    case "tempo":
      return periodWindow(beat);
    case "adsr":
      return periodWindow(adsrCycle(route, sources).cycle);
    case "track": {
      const g = route.settings === undefined ? undefined : route.settings.gesture;
      return g === undefined || g.durationMs <= 0 ? LIVE_WINDOW_S : periodWindow(gesturePeriodS(g));
    }
    default:
      return LIVE_WINDOW_S;
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
