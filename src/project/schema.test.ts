import { describe, expect, it } from "@jest/globals";

import type { Project } from "../state/types";
import { createProject, defaultProjectName, MAX_STROKES, SCHEMA_VERSION, validateProject } from "./schema";

const NOW = new Date(2026, 10, 3, 14, 5);

function sample(): Project {
  const p = createProject({
    id: "p1",
    media: { kind: "photo", file: "media.jpg", width: 4032, height: 3024 },
    seed: 42,
    now: NOW,
  });
  p.scene.layers = [
    { kind: "effect", id: "a", effect: "vhs", params: { x: 0.3, y: 0.4 }, visible: true },
    { kind: "generator", id: "g", generator: "bars", params: { x: 0.5, y: 0.5 }, visible: false, blend: "screen" },
  ];
  p.scene.routes = [
    { id: "r", source: "lfo", sourceIndex: 0, target: { layerId: "a", param: "x" }, amount: -0.5, curve: "exp", mode: "add" },
  ];
  p.scene.paint.strokes = [
    {
      id: "s1",
      strokeSeed: 9,
      stamps: [{ x: 0.1, y: 0.2, size: 0.05, effect: "pixel", erase: false, params: [6], seed: 3 }],
    },
  ];
  p.scene.tracks = [{ durationMs: 1000, rateHz: 30, samples: [0.1, 0.2, 0.3, 0.4] }];
  return p;
}

describe("defaultProjectName", () => {
  it("usa día, mes abreviado y hora", () => {
    expect(defaultProjectName(NOW)).toBe("3 NOV 14:05");
    expect(defaultProjectName(new Date(2026, 0, 21, 9, 7))).toBe("21 ENE 09:07");
  });
});

describe("createProject", () => {
  it("crea un proyecto válido de la versión actual con escena vacía", () => {
    const p = createProject({ id: "x", media: { kind: "generative", width: 1080, height: 1920 }, seed: 1, now: NOW });
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.name).toBe("3 NOV 14:05");
    expect(p.createdAt).toBe(p.updatedAt);
    expect(p.scene.crop).toEqual({ aspect: "free", rect: [0, 0, 1, 1] });
    expect(validateProject(p)).toEqual({ ok: true, value: p });
  });
});

describe("validateProject", () => {
  it("acepta un proyecto completo y sobrevive a JSON", () => {
    const p = sample();
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual({ ok: true, value: p });
  });

  it("descarta campos desconocidos", () => {
    const raw = { ...sample(), extra: true };
    const result = validateProject(raw);
    expect(result.ok && "extra" in result.value).toBe(false);
  });

  it.each([
    ["sin escena", (p: Record<string, unknown>) => delete p.scene, "scene: se esperaba un objeto"],
    [
      "efecto desconocido",
      (p: Record<string, unknown>) => ((p.scene as Project["scene"]).layers[0] as { effect: string }).effect = "blur",
      "scene.layers[0].effect",
    ],
    [
      "parámetro fuera de 0-1",
      (p: Record<string, unknown>) => ((p.scene as Project["scene"]).layers[0].params.x = 2),
      "scene.layers[0].params.x",
    ],
    [
      "cantidad de ruta fuera de -1..1",
      (p: Record<string, unknown>) => ((p.scene as Project["scene"]).routes[0].amount = 3),
      "scene.routes[0].amount",
    ],
    [
      "recorte incompleto",
      (p: Record<string, unknown>) => ((p.scene as Project["scene"]).crop.rect = [0, 0, 1] as never),
      "scene.crop.rect",
    ],
    [
      "semilla no numérica",
      (p: Record<string, unknown>) => ((p.scene as Project["scene"]).seed = NaN),
      "scene.seed",
    ],
  ])("rechaza: %s", (_name, mutate, expectedPath) => {
    const raw = JSON.parse(JSON.stringify(sample()));
    mutate(raw);
    const result = validateProject(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(expectedPath);
  });

  it("rechaza más de 400 trazos", () => {
    const p = sample();
    p.scene.paint.strokes = Array.from({ length: MAX_STROKES + 1 }, (_, i) => ({ id: `s${i}`, strokeSeed: i, stamps: [] }));
    expect(validateProject(p).ok).toBe(false);
  });

  it("rechaza lo que no es un objeto", () => {
    expect(validateProject(null).ok).toBe(false);
    expect(validateProject([]).ok).toBe(false);
    expect(validateProject("{}").ok).toBe(false);
  });
});
