import type { EffectId } from "../effects/registry";
import type { Layer } from "../state/types";

export const MAX_LAYER_COUNT = 12;
export const LAYER_COST_WARNING_THRESHOLD = 24;

const EFFECT_SAMPLE_COUNTS: Record<EffectId, number> = {
  chromatic: 3,
  scanlines: 1,
  datamosh: 2,
  vhs: 2,
  pixelate: 1,
  wave: 1,
};

export function estimateLayerCost(layers: readonly Layer[]): number {
  return layers.reduce(
    (cost, layer) =>
      layer.visible ? cost * EFFECT_SAMPLE_COUNTS[layer.effect] : cost,
    1,
  );
}
