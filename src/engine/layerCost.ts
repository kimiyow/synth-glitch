import type { Layer } from "../domain/types";
import { EFFECT_BY_ID } from "./registry";

// tope técnico de seguridad de la pila
export const MAX_LAYERS = 12;
// umbral inicial de aviso; se puede ajustar
export const COST_WARNING_THRESHOLD = 24;

// muestras de imagen por píxel de una capa; generadores = 1
export function layerSamples(layer: Layer): number {
  return layer.kind === "effect" ? EFFECT_BY_ID[layer.effect].samples : 1;
}

// producto de las muestras de las capas visibles
export function estimateLayerCost(layers: readonly Layer[]): number {
  return layers.reduce((cost, layer) => (layer.visible ? cost * layerSamples(layer) : cost), 1);
}

// se muestra RENDIMIENTO BAJO · n CAPAS sin bloquear
export function isCostHigh(layers: readonly Layer[]): boolean {
  return estimateLayerCost(layers) > COST_WARNING_THRESHOLD;
}

export function canAddLayer(layers: readonly Layer[]): boolean {
  return layers.length < MAX_LAYERS;
}
