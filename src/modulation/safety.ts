import type { EffectId, Layer, Route, SourceConfig } from "../state/types";
import { cycleHz } from "./sources";

/** Parámetros que cambian la luminancia de una zona amplia (3.5). */
const LUMINANCE_PARAMS: Partial<Record<EffectId, readonly ("x" | "y")[]>> = {
  scanlines: ["x", "y"],
  crt: ["y"],
  pixelate: ["y"],
  vhs: ["y"],
};
const MAX_SAFE_HZ = 3;

function sourceHz(route: Route, s: SourceConfig): number {
  const beatHz = s.tempo.bpm / 60;
  if (route.source === "lfo") return s.lfo.depth > 0 ? cycleHz(s.lfo.rateHz, s.lfo.sync, s.lfo.division, s.tempo.bpm) : 0;
  if (route.source === "sh") return beatHz / s.sh.division;
  if (route.source === "seq") return beatHz / s.seq.division;
  if (route.source === "tempo") return beatHz;
  return 0;
}

/**
 * Guardarraíl fotosensible no bloqueante: true si hay que mostrar el aviso. El generador
 * `bars` alterna blanco y negro a 4-24 Hz en toda la imagen (6.4), así que siempre avisa.
 */
export function hasFastLuminanceRoute(layers: readonly Layer[], routes: readonly Route[], sources: SourceConfig): boolean {
  if (layers.some((l) => l.kind === "generator" && l.generator === "bars" && l.visible)) return true;
  return routes.some((r) => {
    const layer = layers.find((l) => l.id === r.target.layerId);
    if (!layer || layer.kind !== "effect" || !layer.visible || r.amount === 0) return false;
    return (LUMINANCE_PARAMS[layer.effect] ?? []).includes(r.target.param) && sourceHz(r, sources) > MAX_SAFE_HZ;
  });
}
