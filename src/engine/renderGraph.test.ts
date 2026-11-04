import { describe, expect, it } from "@jest/globals";

import type { EffectId, Layer } from "../state/types";
import { MAX_LAYERS } from "./layerCost";
import { buildLayerChain, nodeUniforms } from "./renderGraph";

function fx(id: string, effect: EffectId, visible = true, x = 0.1, y = 0.2): Layer {
  return { kind: "effect", id, effect, params: { x, y }, visible };
}

describe("buildLayerChain", () => {
  it("conserva el orden y omite capas ocultas", () => {
    const chain = buildLayerChain([fx("a", "vhs"), fx("b", "crt", false), fx("c", "wave")]);
    expect(chain.map((n) => n.layerId)).toEqual(["a", "c"]);
  });

  it("incluye generadores en su lugar de la pila, con su modo de mezcla", () => {
    const gen: Layer = {
      kind: "generator",
      id: "g",
      generator: "bars",
      params: { x: 0, y: 0 },
      visible: true,
      blend: "multiply",
    };
    const chain = buildLayerChain([fx("a", "vhs"), gen, fx("b", "crt")]);
    expect(chain.map((n) => n.layerId)).toEqual(["a", "g", "b"]);
    expect(chain[1]).toMatchObject({ kind: "generator", generator: "bars", blend: 2 });
  });

  it("solo los generadores reciben el uniform blend", () => {
    const gen: Layer = { kind: "generator", id: "g", generator: "noise", params: { x: 0.5, y: 0.5 }, visible: true, blend: "screen" };
    const chain = buildLayerChain([fx("a", "vhs"), gen]);
    const frame = { time: 0, params: [] };
    expect(nodeUniforms(chain, 0, frame, [1, 1], 0)).not.toHaveProperty("blend");
    expect(nodeUniforms(chain, 1, frame, [1, 1], 0).blend).toBe(1);
  });

  it("corta en el tope técnico", () => {
    const many = Array.from({ length: MAX_LAYERS + 3 }, (_, i) => fx(`l${i}`, "wave"));
    expect(buildLayerChain(many)).toHaveLength(MAX_LAYERS);
  });

  it("copia los valores base para no compartir referencias con la escena", () => {
    const layer = fx("a", "vhs");
    const [node] = buildLayerChain([layer]);
    expect(node.base).toEqual(layer.params);
    expect(node.base).not.toBe(layer.params);
  });
});

describe("nodeUniforms", () => {
  const chain = buildLayerChain([fx("a", "vhs", true, 0.1, 0.2), fx("b", "crt", true, 0.3, 0.4)]);

  it("usa los valores base si el cuadro no trae parámetros", () => {
    expect(nodeUniforms(chain, 1, { time: 2, params: [] }, [100, 50], 7)).toEqual({
      resolution: [100, 50],
      param: [0.3, 0.4],
      time: 2,
      seed: 7,
    });
  });

  it("usa los parámetros efectivos del cuadro, recortados a 0-1", () => {
    const frame = { time: 0, params: [0.5, 0.6, 1.4, -0.2] };
    expect(nodeUniforms(chain, 0, frame, [1, 1], 0).param).toEqual([0.5, 0.6]);
    expect(nodeUniforms(chain, 1, frame, [1, 1], 0).param).toEqual([1, 0]);
  });

  it("reduce la semilla del proyecto a un rango que la GPU puede usar", () => {
    expect(nodeUniforms(chain, 0, { time: 0, params: [] }, [1, 1], 2_000_000_123).seed).toBe(123);
    expect(nodeUniforms(chain, 0, { time: 0, params: [] }, [1, 1], 7).seed).toBe(7);
  });

  it("suma la semilla propia del generador a la del proyecto", () => {
    const gen: Layer = { kind: "generator", id: "g", generator: "noise", params: { x: 0, y: 0 }, visible: true, blend: "screen", seed: 5 };
    expect(nodeUniforms(buildLayerChain([gen]), 0, { time: 0, params: [] }, [1, 1], 998).seed).toBe(3);
  });
});
