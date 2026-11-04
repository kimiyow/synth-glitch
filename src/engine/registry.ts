import type { BlendMode, EffectId, GeneratorId } from "../state/types";
import { CHROMATIC_SKSL } from "./effects/chromatic.sksl";
import { CRT_SKSL } from "./effects/crt.sksl";
import { DATAMOSH_SKSL } from "./effects/datamosh.sksl";
import { PIXELATE_SKSL } from "./effects/pixelate.sksl";
import { SCANLINES_SKSL } from "./effects/scanlines.sksl";
import { VHS_SKSL } from "./effects/vhs.sksl";
import { WAVE_SKSL } from "./effects/wave.sksl";
import { BARS_SKSL } from "./generators/bars.sksl";
import { NOISE_SKSL } from "./generators/noise.sksl";
import { VORONOI_SKSL } from "./generators/voronoi.sksl";

export type EffectDef = {
  id: EffectId;
  /** Texto de la ficha en el panel Efectos. */
  label: string;
  /** Valores por defecto de la tabla 6.3. */
  defaults: { x: number; y: number };
  /** Muestras de imagen por píxel (3.4), para layerCost. */
  samples: number;
  /** Qué controla cada eje (tabla 6.3), para los deslizadores del panel. */
  axes: { x: string; y: string };
  sksl: string;
};

/** Orden de FX-01. */
export const EFFECTS: readonly EffectDef[] = [
  { id: "chromatic", label: "CHROMATIC", defaults: { x: 0.3, y: 0.0 }, samples: 3, axes: { x: "Desplazamiento", y: "Ángulo" }, sksl: CHROMATIC_SKSL },
  { id: "scanlines", label: "SCANLINES", defaults: { x: 0.4, y: 0.2 }, samples: 1, axes: { x: "Líneas", y: "Ruido" }, sksl: SCANLINES_SKSL },
  { id: "datamosh", label: "DATAMOSH", defaults: { x: 0.3, y: 0.3 }, samples: 1, axes: { x: "Alto de franja", y: "Desplazamiento" }, sksl: DATAMOSH_SKSL },
  { id: "vhs", label: "VHS", defaults: { x: 0.3, y: 0.4 }, samples: 2, axes: { x: "Temblor", y: "Tracking" }, sksl: VHS_SKSL },
  { id: "pixelate", label: "PIXEL", defaults: { x: 0.25, y: 0.0 }, samples: 1, axes: { x: "Tamaño de bloque", y: "Posterizado" }, sksl: PIXELATE_SKSL },
  { id: "wave", label: "WAVE", defaults: { x: 0.3, y: 0.3 }, samples: 1, axes: { x: "Amplitud", y: "Ondas" }, sksl: WAVE_SKSL },
  { id: "crt", label: "CRT", defaults: { x: 0.25, y: 0.5 }, samples: 2, axes: { x: "Curvatura", y: "Máscara" }, sksl: CRT_SKSL },
];

export const EFFECT_BY_ID: Readonly<Record<EffectId, EffectDef>> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e]),
) as Record<EffectId, EffectDef>;

export type GeneratorDef = {
  id: GeneratorId;
  label: string;
  /** El SDD no fija valores por defecto para los generadores (6.4); estos se eligieron en M8. */
  defaults: { x: number; y: number };
  /** Qué controla cada eje (tabla 6.4). */
  axes: { x: string; y: string };
  sksl: string;
};

/** Orden de GEN-01. */
export const GENERATORS: readonly GeneratorDef[] = [
  { id: "noise", label: "NOISE", defaults: { x: 0.3, y: 0.3 }, axes: { x: "Escala", y: "Velocidad" }, sksl: NOISE_SKSL },
  { id: "bars", label: "BARRAS", defaults: { x: 0.3, y: 0.2 }, axes: { x: "Densidad", y: "Velocidad" }, sksl: BARS_SKSL },
  { id: "voronoi", label: "VORONOI", defaults: { x: 0.3, y: 0.3 }, axes: { x: "Celdas", y: "Velocidad" }, sksl: VORONOI_SKSL },
];

export const GENERATOR_BY_ID: Readonly<Record<GeneratorId, GeneratorDef>> = Object.fromEntries(
  GENERATORS.map((g) => [g.id, g]),
) as Record<GeneratorId, GeneratorDef>;

/** Valor del uniform `blend` de los generadores (ver generators/contract.ts). */
export const BLEND_INDEX: Readonly<Record<BlendMode, number>> = { replace: 0, screen: 1, multiply: 2, difference: 3 };
