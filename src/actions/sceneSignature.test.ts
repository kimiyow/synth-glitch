import { describe, expect, it } from "@jest/globals";

import type { Layer, Route } from "../domain/types";
import { findSameScene, sceneSignature } from "./scenePresets";

const layers = (prefix: string, x = 0.4): Layer[] => [
  { kind: "effect", id: `${prefix}-a`, effect: "vhs", params: { x, y: 0.5 }, visible: true },
  { kind: "effect", id: `${prefix}-b`, effect: "wave", params: { x: 0.2, y: 0.3 }, visible: true },
];
const routes = (prefix: string): Route[] => [
  { id: `${prefix}-r`, source: "lfo", sourceIndex: 0, target: { layerId: `${prefix}-b`, param: "x" }, amount: 0.5, curve: "lin", mode: "add" },
];

describe("firma de escena", () => {
  it("ignora los ids: una escena aplicada desde un preset es la misma", () => {
    expect(sceneSignature(layers("p"), routes("p"))).toBe(sceneSignature(layers("q"), routes("q")));
  });

  it("distingue parámetros y a qué capa va cada modulación", () => {
    expect(sceneSignature(layers("p", 0.9), routes("p"))).not.toBe(sceneSignature(layers("p"), routes("p")));
    const moved: Route[] = [{ ...routes("p")[0], target: { layerId: "p-a", param: "x" } }];
    expect(sceneSignature(layers("p"), moved)).not.toBe(sceneSignature(layers("p"), routes("p")));
  });

  it("una escena sin capas no coincide con nada", () => {
    expect(findSameScene([{ id: "s", name: "Vacía", builtIn: false, layers: [], routes: [], sources: {} as never }], [], [])).toBeNull();
  });
});
