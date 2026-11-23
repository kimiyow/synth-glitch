import type { EffectId, GeneratorId, Layer } from "../domain/types";
import { MAX_LAYERS } from "./layerCost";
import { BLEND_INDEX } from "./registry";

// render graph puro: medio → pintura → capas visibles en orden → recorte. Cada nodo es una capa de
// efecto o de generador; el generador mezcla su salida con la capa de abajo según blend
export type ChainNode = {
  layerId: string;
  // valores base (x, y) de la capa; la modulación los sobrescribe por cuadro
  base: { x: number; y: number };
} & (
  | { kind: "effect"; effect: EffectId; blend: number }
  | { kind: "generator"; generator: GeneratorId; blend: number; seedOffset: number }
);

// entradas que cambian por cuadro: tiempo y (x, y) efectivos por nodo, intercalados
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
// generadores y efectos reciben blend (modo de mezcla con la capa de abajo)
export type NodeUniforms = EffectUniforms & { blend: number };

// capas visibles (efectos y generadores), la primera se aplica antes; nunca más de MAX_LAYERS
export function buildLayerChain(layers: readonly Layer[]): ChainNode[] {
  const chain: ChainNode[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    if (chain.length === MAX_LAYERS) break;
    const base = { ...layer.params };
    chain.push(
      layer.kind === "effect"
        ? { kind: "effect", layerId: layer.id, effect: layer.effect, blend: BLEND_INDEX[layer.blend ?? "replace"], base }
        : {
            kind: "generator",
            layerId: layer.id,
            generator: layer.generator,
            blend: BLEND_INDEX[layer.blend],
            seedOffset: layer.seed ?? 0,
            base,
          },
    );
  }
  return chain;
}

// la semilla del proyecto llega a 2^31, pero la GPU usa float de 32 bits: con números así de
// grandes los hash de los generadores dan siempre el mismo valor (imagen negra). Se reduce aquí, en
// JS (exacto), a 0-999; sigue siendo determinista por proyecto
export const SHADER_SEED_RANGE = 1000;

// declaradas antes de usarse: el plugin de worklets no eleva las funciones
function shaderSeed(seed: number): number {
  "worklet";
  return ((seed % SHADER_SEED_RANGE) + SHADER_SEED_RANGE) % SHADER_SEED_RANGE;
}

function clamp01(v: number): number {
  "worklet";
  return Math.min(1, Math.max(0, v));
}

// uniforms del nodo index. Se usa igual en el hilo de UI (preview) y en JS (exportar)
export function nodeUniforms(
  chain: readonly ChainNode[],
  index: number,
  frame: FrameInputs,
  resolution: [number, number],
  seed: number,
): NodeUniforms {
  "worklet";
  const node = chain[index];
  const x = frame.params[index * 2] ?? node.base.x;
  const y = frame.params[index * 2 + 1] ?? node.base.y;
  const uniforms: NodeUniforms = {
    resolution,
    param: [clamp01(x), clamp01(y)],
    time: frame.time,
    seed: shaderSeed(node.kind === "generator" ? seed + node.seedOffset : seed),
    blend: node.blend,
  };
  return uniforms;
}
