import { describe, expect, it } from "@jest/globals";

import type { EffectId, Layer } from "../state/types";
import { MAX_LAYERS } from "./layerCost";
import { buildEffectChain, nodeUniforms } from "./renderGraph";

function fx(id: string, effect: EffectId, visible = true, x = 0.1, y = 0.2): Layer {
  return { kind: "effect", id, effect, params: { x, y }, visible };
}

describe("buildEffectChain", () => {
  it("conserva el orden y omite capas ocultas", () => {
    const chain = buildEffectChain([fx("a", "vhs"), fx("b", "crt", false), fx("c", "wave")]);
    expect(chain.map((n) => n.layerId)).toEqual(["a", "c"]);
  });

  it("omite generadores hasta M8", () => {
    const gen: Layer = {
      kind: "generator",
      id: "g",
      generator: "bars",
      params: { x: 0, y: 0 },
      visible: true,
      blend: "replace",
    };
    expect(buildEffectChain([gen, fx("a", "vhs")]).map((n) => n.layerId)).toEqual(["a"]);
  });

  it("corta en el tope técnico", () => {
    const many = Array.from({ length: MAX_LAYERS + 3 }, (_, i) => fx(`l${i}`, "wave"));
    expect(buildEffectChain(many)).toHaveLength(MAX_LAYERS);
  });

  it("copia los valores base para no compartir referencias con la escena", () => {
    const layer = fx("a", "vhs");
    const [node] = buildEffectChain([layer]);
    expect(node.base).toEqual(layer.params);
    expect(node.base).not.toBe(layer.params);
  });
});

describe("nodeUniforms", () => {
  const chain = buildEffectChain([fx("a", "vhs", true, 0.1, 0.2), fx("b", "crt", true, 0.3, 0.4)]);

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
});
