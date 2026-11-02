import { describe, expect, it } from "@jest/globals";
import {
  estimateLayerCost,
  MAX_LAYER_COUNT,
} from "./layerCost";
import type { Layer } from "../state/types";

function createLayer(
  effect: Layer["effect"],
  visible = true,
): Layer {
  return {
    id: `${effect}-${visible}`,
    effect,
    params: { x: 0.3, y: 0.2 },
    lfoX: { enabled: false, shape: "sine", rateHz: 1, depth: 0 },
    lfoY: { enabled: false, shape: "sine", rateHz: 1, depth: 0 },
    visible,
  };
}

describe("estimateLayerCost", () => {
  it("multiplies the per-pixel cost of visible effects", () => {
    expect(
      estimateLayerCost([
        createLayer("chromatic"),
        createLayer("chromatic"),
        createLayer("scanlines"),
      ]),
    ).toBe(9);
  });

  it("ignores hidden layers", () => {
    expect(
      estimateLayerCost([
        createLayer("chromatic", false),
        createLayer("scanlines"),
      ]),
    ).toBe(1);
  });

  it("uses the shader sample count for all six effects", () => {
    expect(
      estimateLayerCost([
        createLayer("chromatic"),
        createLayer("scanlines"),
        createLayer("datamosh"),
        createLayer("vhs"),
        createLayer("pixelate"),
        createLayer("wave"),
      ]),
    ).toBe(12);
  });

  it("keeps the technical layer limit at twelve", () => {
    expect(MAX_LAYER_COUNT).toBe(12);
  });
});
