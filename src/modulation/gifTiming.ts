import type { Layer, Route, SourceConfig } from "../state/types";
import { cycleHz } from "./sources";

/** GIF de 3.11: 12 fps, hasta 4 s (48 cuadros); 3 s si nada marca un periodo. */
export const GIF_FPS = 12;
export const GIF_MAX_S = 4;
export const GIF_DEFAULT_S = 3;

/** Periodo (s) de la fuente de una ruta, o null si no es periódica (ADSR, en vivo). */
function routePeriod(route: Route, s: SourceConfig): number | null {
  const beat = 60 / s.tempo.bpm;
  switch (route.source) {
    case "lfo": {
      const hz = cycleHz(s.lfo.rateHz, s.lfo.sync, s.lfo.division, s.tempo.bpm);
      return s.lfo.depth > 0 && hz > 0 ? 1 / hz : null;
    }
    case "sh":
      return beat * s.sh.division;
    case "seq":
      return beat * s.seq.division * s.seq.steps.length;
    case "tempo":
      return beat;
    default:
      return null;
  }
}

/**
 * Duración del GIF (3.11): el periodo más largo de las fuentes periódicas activas (si es
 * corto se repite hasta durar al menos 1 s, para un bucle sin salto) o 3 s; nunca más de 4 s.
 */
export function gifDurationS(layers: readonly Layer[], routes: readonly Route[], sources: SourceConfig): number {
  const visible = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  let period = 0;
  for (const r of routes) {
    if (r.amount === 0 || !visible.has(r.target.layerId)) continue;
    const p = routePeriod(r, sources);
    if (p !== null) period = Math.max(period, p);
  }
  if (period === 0 || period > GIF_MAX_S) return period === 0 ? GIF_DEFAULT_S : GIF_MAX_S;
  return Math.min(GIF_MAX_S, period * Math.ceil(1 / period));
}

export function gifFrameCount(durationS: number): number {
  return Math.max(1, Math.round(durationS * GIF_FPS));
}
