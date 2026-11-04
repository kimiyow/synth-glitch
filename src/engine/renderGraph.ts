import type { EffectId, Layer } from "../state/types";
import { MAX_LAYERS } from "./layerCost";

/**
 * Render graph puro (SDD 3.3 y 3.4): medio → efectos visibles en orden → salida.
 * La pintura (M6), los generadores (M8) y el recorte (M3) se suman en sus hitos.
 */
export type ChainNode = {
  layerId: string;
  effect: EffectId;
  /** Valores base (x, y) de la capa; la modulación los sobrescribe por cuadro. */
  base: { x: number; y: number };
};

/** Entradas que cambian por cuadro: tiempo y (x, y) efectivos por nodo, intercalados. */
export type FrameInputs = {
  time: number;
  params: readonly number[];
};

export type EffectUniforms = {
  resolution: [number, number];
  param: [number, number];
  time: number;
  seed: number;
};

/** Capas de efecto visibles, la primera se aplica antes; nunca más de MAX_LAYERS. */
export function buildEffectChain(layers: readonly Layer[]): ChainNode[] {
  const chain: ChainNode[] = [];
  for (const layer of layers) {
    if (layer.kind !== "effect" || !layer.visible) continue;
    if (chain.length === MAX_LAYERS) break;
    chain.push({ layerId: layer.id, effect: layer.effect, base: { ...layer.params } });
  }
  return chain;
}

// Declarada antes de usarse: el plugin de worklets no eleva las funciones.
function clamp01(v: number): number {
  "worklet";
  return Math.min(1, Math.max(0, v));
}

/** Uniforms del nodo `index`. Se usa igual en el hilo de UI (preview) y en JS (exportar). */
export function nodeUniforms(
  chain: readonly ChainNode[],
  index: number,
  frame: FrameInputs,
  resolution: [number, number],
  seed: number,
): EffectUniforms {
  "worklet";
  const node = chain[index];
  const x = frame.params[index * 2] ?? node.base.x;
  const y = frame.params[index * 2 + 1] ?? node.base.y;
  return {
    resolution,
    param: [clamp01(x), clamp01(y)],
    time: frame.time,
    seed,
  };
}
