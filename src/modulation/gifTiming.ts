import type { Layer, Route, SourceConfig } from "../domain/types";
import { cycleHz, routeLfo, routeSeq, routeSh } from "./sources";

// GIF: 12 fps, hasta 4 s (48 cuadros); 3 s si nada marca un periodo
export const GIF_FPS = 12;
export const GIF_MAX_S = 4;
export const GIF_DEFAULT_S = 3;

// periodo (s) de la fuente de una ruta, o null si no es periódica (ADSR, en vivo)
function routePeriod(route: Route, s: SourceConfig): number | null {
  const beat = 60 / s.tempo.bpm;
  switch (route.source) {
    case "lfo": {
      const lfo = routeLfo(route, s);
      const hz = cycleHz(lfo.rateHz, lfo.sync, lfo.division, s.tempo.bpm);
      return lfo.depth > 0 && hz > 0 ? 1 / hz : null;
    }
    case "sh":
      return beat * routeSh(route, s).division;
    case "seq": {
      const seq = routeSeq(route, s);
      return beat * seq.division * seq.steps.length;
    }
    case "tempo":
      return beat;
    case "track": {
      const g = route.settings?.gesture;
      return g && g.samples.length >= 4 && g.durationMs > 0 ? g.durationMs / 1000 : null;
    }
    default:
      return null;
  }
}

// duración del GIF: el periodo más largo de las fuentes periódicas activas (si es corto se repite
// hasta durar al menos 1 s, para un bucle sin salto) o 3 s; nunca más de 4 s
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
