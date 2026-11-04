import type { EffectId } from "../state/types";
import { CHROMATIC_SKSL } from "./effects/chromatic.sksl";
import { CRT_SKSL } from "./effects/crt.sksl";
import { DATAMOSH_SKSL } from "./effects/datamosh.sksl";
import { PIXELATE_SKSL } from "./effects/pixelate.sksl";
import { SCANLINES_SKSL } from "./effects/scanlines.sksl";
import { VHS_SKSL } from "./effects/vhs.sksl";
import { WAVE_SKSL } from "./effects/wave.sksl";

export type EffectDef = {
  id: EffectId;
  /** Texto de la ficha en el panel Efectos. */
  label: string;
  /** Valores por defecto de la tabla 6.3. */
  defaults: { x: number; y: number };
  /** Muestras de imagen por píxel (3.4), para layerCost. */
  samples: number;
  sksl: string;
};

/** Orden de FX-01. */
export const EFFECTS: readonly EffectDef[] = [
  { id: "chromatic", label: "CHROMATIC", defaults: { x: 0.3, y: 0.0 }, samples: 3, sksl: CHROMATIC_SKSL },
  { id: "scanlines", label: "SCANLINES", defaults: { x: 0.4, y: 0.2 }, samples: 1, sksl: SCANLINES_SKSL },
  { id: "datamosh", label: "DATAMOSH", defaults: { x: 0.3, y: 0.3 }, samples: 1, sksl: DATAMOSH_SKSL },
  { id: "vhs", label: "VHS", defaults: { x: 0.3, y: 0.4 }, samples: 2, sksl: VHS_SKSL },
  { id: "pixelate", label: "PIXEL", defaults: { x: 0.25, y: 0.0 }, samples: 1, sksl: PIXELATE_SKSL },
  { id: "wave", label: "WAVE", defaults: { x: 0.3, y: 0.3 }, samples: 1, sksl: WAVE_SKSL },
  { id: "crt", label: "CRT", defaults: { x: 0.25, y: 0.5 }, samples: 2, sksl: CRT_SKSL },
];

export const EFFECT_BY_ID: Readonly<Record<EffectId, EffectDef>> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e]),
) as Record<EffectId, EffectDef>;
