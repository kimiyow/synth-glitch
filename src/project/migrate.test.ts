import { describe, expect, it } from "@jest/globals";

import { loadProject, type Migrations } from "./migrate";
import { createProject, SCHEMA_VERSION } from "./schema";

const NOW = new Date(2026, 10, 3, 14, 5);
const current = () =>
  JSON.parse(
    JSON.stringify(
      createProject({ id: "p", media: { kind: "photo", file: "media.jpg", width: 10, height: 10 }, seed: 1, now: NOW }),
    ),
  );

describe("loadProject", () => {
  it("abre la versión actual sin migrar y editable", () => {
    const result = loadProject(current());
    expect(result).toMatchObject({ ok: true, readOnly: false, migratedFrom: null });
  });

  it("aplica las migraciones en orden desde una versión antigua", () => {
    // Simula una app en versión 3 que lee un archivo de la versión 1.
    const calls: number[] = [];
    const migrations: Migrations = {
      1: (raw) => (calls.push(1), { ...raw, title: raw.name }),
      2: (raw) => (calls.push(2), { ...raw, name: raw.title }),
    };
    const v1 = { ...current(), schemaVersion: 1, name: "viejo" };
    const result = loadProject(v1, migrations, 3);
    expect(calls).toEqual([1, 2]);
    expect(result.ok && result.project.schemaVersion).toBe(3);
    expect(result.ok && result.project.name).toBe("viejo");
    expect(result.ok && result.migratedFrom).toBe(1);
  });

  it("falla si falta una migración", () => {
    const result = loadProject({ ...current(), schemaVersion: 1 }, {}, 2);
    expect(result).toEqual({ ok: false, error: "FALTA LA MIGRACIÓN DE LA VERSIÓN 1" });
  });

  it("abre en solo lectura un archivo de una versión futura legible", () => {
    const future = { ...current(), schemaVersion: SCHEMA_VERSION + 1, campoNuevo: [1, 2] };
    expect(loadProject(future)).toMatchObject({ ok: true, readOnly: true });
  });

  it("rechaza un archivo futuro que no se puede leer", () => {
    const future = { ...current(), schemaVersion: SCHEMA_VERSION + 1, scene: "otro formato" };
    const result = loadProject(future);
    expect(result.ok).toBe(false);
  });

  it.each([null, [], "x", { schemaVersion: 0 }, { schemaVersion: 1.5 }, {}])("rechaza %p", (raw) => {
    expect(loadProject(raw).ok).toBe(false);
  });

  it("informa de un proyecto dañado", () => {
    const broken = { ...current(), scene: { ...current().scene, seed: "x" } };
    const result = loadProject(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^PROYECTO DAÑADO/);
  });
});
