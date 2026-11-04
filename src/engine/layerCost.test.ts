import { describe, expect, it } from "@jest/globals";
import { array, assert, boolean, constantFrom, property, record } from "fast-check";

import type { EffectId, Layer } from "../state/types";
import {
  canAddLayer,
  COST_WARNING_THRESHOLD,
  estimateLayerCost,
  isCostHigh,
  MAX_LAYERS,
} from "./layerCost";

const EFFECT_IDS: EffectId[] = ["chromatic", "scanlines", "datamosh", "vhs", "pixelate", "wave", "crt"];

function fx(effect: EffectId, visible = true): Layer {
  return { kind: "effect", id: effect, effect, params: { x: 0, y: 0 }, visible };
}

const layerArb = record({ effect: constantFrom(...EFFECT_IDS), visible: boolean() }).map(
  ({ effect, visible }) => fx(effect, visible),
);

describe("layerCost", () => {
  it("una pila vacía cuesta 1", () => {
    expect(estimateLayerCost([])).toBe(1);
  });

  it("multiplica las muestras de las capas visibles", () => {
    expect(estimateLayerCost([fx("chromatic"), fx("vhs"), fx("crt")])).toBe(12);
    expect(estimateLayerCost([fx("chromatic"), fx("vhs", false)])).toBe(3);
  });

  it("los generadores cuentan 1", () => {
    const gen: Layer = {
      kind: "generator",
      id: "g",
      generator: "noise",
      params: { x: 0, y: 0 },
      visible: true,
      blend: "screen",
    };
    expect(estimateLayerCost([fx("chromatic"), gen])).toBe(3);
  });

  it("avisa solo por encima del umbral", () => {
    // 3 · 2 · 2 · 2 = 24 → justo en el umbral, sin aviso
    const at = [fx("chromatic"), fx("vhs"), fx("crt"), fx("vhs")];
    expect(estimateLayerCost(at)).toBe(COST_WARNING_THRESHOLD);
    expect(isCostHigh(at)).toBe(false);
    expect(isCostHigh([...at, fx("crt")])).toBe(true);
  });

  it("limita la pila a 12 capas", () => {
    const eleven = Array.from({ length: MAX_LAYERS - 1 }, () => fx("wave"));
    expect(canAddLayer(eleven)).toBe(true);
    expect(canAddLayer([...eleven, fx("wave")])).toBe(false);
  });

  it("ocultar capas nunca sube el costo y el orden no importa", () => {
    assert(
      property(array(layerArb, { maxLength: MAX_LAYERS }), (layers) => {
        const cost = estimateLayerCost(layers);
        expect(cost).toBeGreaterThanOrEqual(1);
        expect(estimateLayerCost([...layers].reverse())).toBe(cost);
        expect(estimateLayerCost(layers.map((l) => ({ ...l, visible: false })))).toBeLessThanOrEqual(cost);
      }),
    );
  });
});
