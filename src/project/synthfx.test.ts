import { describe, expect, it } from "@jest/globals";

import type { Scene } from "../state/types";
import { createScene } from "./schema";
import { applySynthFx, createSynthFx, parseSynthFx, serializeSynthFx, synthFxFileName } from "./synthfx";

function sceneWithStack(): Scene {
  const scene = createScene({ kind: "photo", file: "media.jpg", width: 10, height: 10 }, 42);
  scene.layers = [
    { kind: "effect", id: "a", effect: "vhs", params: { x: 0.1, y: 0.2 }, visible: true },
    { kind: "generator", id: "g", generator: "bars", params: { x: 0.5, y: 0.5 }, visible: true, blend: "screen", seed: 3 },
  ];
  scene.routes = [
    { id: "a-x", source: "lfo", sourceIndex: 0, target: { layerId: "a", param: "x" }, amount: 0.5, curve: "lin", mode: "add" },
  ];
  scene.paint.strokes = [{ id: "s", strokeSeed: 1, stamps: [] }];
  return scene;
}

describe(".synthfx", () => {
  it("ida y vuelta: exportar e importar reproduce capas, rutas, fuentes y semilla (CA-23)", () => {
    const scene = sceneWithStack();
    const parsed = parseSynthFx(serializeSynthFx(createSynthFx("Mi escena", scene)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const target = createScene({ kind: "photo", file: "otra.jpg", width: 5, height: 5 }, 7);
    target.paint.strokes = [{ id: "t", strokeSeed: 9, stamps: [] }];
    applySynthFx(target, parsed.value);
    expect(target.layers).toEqual(scene.layers);
    expect(target.routes).toEqual(scene.routes);
    expect(target.sources).toEqual(scene.sources);
    expect(target.seed).toBe(42);
    // La pintura no viaja en la receta.
    expect(target.paint.strokes.map((s) => s.id)).toEqual(["t"]);
  });

  it("no incluye la pintura", () => {
    expect(serializeSynthFx(createSynthFx("x", sceneWithStack()))).not.toMatch(/strokes|paint/);
  });

  it.each([
    ["JSON roto", "{nope"],
    ["otra versión", JSON.stringify({ synthfx: 2, name: "x", layers: [], routes: [], sources: {}, seed: 1 })],
    ["efecto desconocido", JSON.stringify({ synthfx: 1, name: "x", layers: [{ kind: "effect", id: "a", effect: "sksl", params: { x: 0, y: 0 }, visible: true }], routes: [], sources: {}, seed: 1 })],
    ["ruta a una capa inexistente", JSON.stringify({ synthfx: 1, name: "x", layers: [], routes: [{ id: "r", source: "lfo", sourceIndex: 0, target: { layerId: "zz", param: "x" }, amount: 0.5, curve: "lin", mode: "add" }], sources: {}, seed: 1 })],
    ["parámetro fuera de rango", JSON.stringify({ synthfx: 1, name: "x", layers: [{ kind: "effect", id: "a", effect: "vhs", params: { x: 3, y: 0 }, visible: true }], routes: [], sources: {}, seed: 1 })],
  ])("rechaza un archivo inválido: %s", (_why, text) => {
    expect(parseSynthFx(text).ok).toBe(false);
  });

  it("rechaza archivos de más de 200 KB (NFR-12)", () => {
    const big = JSON.stringify({ synthfx: 1, name: "x".repeat(210 * 1024), layers: [], routes: [], sources: {}, seed: 1 });
    const result = parseSynthFx(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/200 KB/);
  });

  it("arma un nombre de archivo seguro", () => {
    expect(synthFxFileName("Escena  Nº 1 · ñandú")).toBe("Escena-N-1-nandu.synthfx");
    expect(synthFxFileName("···")).toBe("escena.synthfx");
  });
});
