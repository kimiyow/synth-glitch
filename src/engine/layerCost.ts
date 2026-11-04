import type { Layer } from "../state/types";
import { EFFECT_BY_ID } from "./registry";

/** Tope técnico de seguridad de la pila (FX-02). */
export const MAX_LAYERS = 12;
/** Umbral inicial de aviso (3.4); se calibra en SP-04. */
export const COST_WARNING_THRESHOLD = 24;

/** Muestras de imagen por píxel de una capa (3.4); generadores = 1. */
export function layerSamples(layer: Layer): number {
  return layer.kind === "effect" ? EFFECT_BY_ID[layer.effect].samples : 1;
}

/** Producto de las muestras de las capas visibles. */
export function estimateLayerCost(layers: readonly Layer[]): number {
  return layers.reduce((cost, layer) => (layer.visible ? cost * layerSamples(layer) : cost), 1);
}

/** Se muestra `RENDIMIENTO BAJO · n CAPAS` sin bloquear (FX-03). */
export function isCostHigh(layers: readonly Layer[]): boolean {
  return estimateLayerCost(layers) > COST_WARNING_THRESHOLD;
}

export function canAddLayer(layers: readonly Layer[]): boolean {
  return layers.length < MAX_LAYERS;
}
