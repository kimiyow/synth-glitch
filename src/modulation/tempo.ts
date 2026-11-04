import { MAX_BPM, MIN_BPM } from "./sources";

/** Fase del pulso 0..1 (fuente `tempo`). */
export function beatPhase(bpm: number, t: number): number {
  "worklet";
  const b = (t * bpm) / 60;
  return b - Math.floor(b);
}

const TAP_RESET_MS = 2000;

/**
 * Tap tempo (MOD-02): promedia los últimos intervalos; una pausa de más de 2 s empieza
 * de nuevo. Devuelve los toques a conservar y el BPM (null hasta tener dos toques).
 */
export function tapTempo(taps: readonly number[], now: number): { taps: number[]; bpm: number | null } {
  const last = taps.at(-1);
  const kept = last !== undefined && now - last <= TAP_RESET_MS ? [...taps, now].slice(-5) : [now];
  if (kept.length < 2) return { taps: kept, bpm: null };
  const avg = (kept[kept.length - 1] - kept[0]) / (kept.length - 1);
  return { taps: kept, bpm: Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, 60000 / avg))) };
}
