import { beforeEach, describe, expect, it } from "@jest/globals";

import { createProject } from "../project/schema";
import type { Project } from "./types";
import { createSceneStore, hasUnsavedWork } from "./sceneStore";

const T0 = new Date(Date.UTC(2026, 10, 3, 10));
const T1 = new Date(Date.UTC(2026, 10, 3, 11));
const project = (id = "p"): Project =>
  createProject({ id, media: { kind: "generative", width: 1, height: 1 }, seed: 1, now: T0 });

describe("sceneStore (guardado manual)", () => {
  let saved: Project[];
  let removed: string[];
  beforeEach(() => {
    saved = [];
    removed = [];
  });

  const make = () =>
    createSceneStore({ save: (p) => saved.push(p), removeDraft: (id) => removed.push(id), now: () => T1 });

  it("un cambio queda sin guardar y solo se escribe al guardar", () => {
    const store = make();
    store.getState().open(project(), false);
    store.getState().commit("semilla", (s) => {
      s.seed = 99;
    });
    expect(store.getState().saveStatus.state).toBe("unsaved");
    expect(saved).toEqual([]);
    expect(store.getState().save()).toBe(true);
    expect(saved.map((p) => p.scene.seed)).toEqual([99]);
    expect(store.getState().saveStatus.state).toBe("saved");
  });

  it("no cambia ni guarda un proyecto de solo lectura", () => {
    const store = make();
    store.getState().open(project(), true);
    store.getState().commit("semilla", (s) => {
      s.seed = 99;
    });
    expect(store.getState().rename("X")).toBe(false);
    expect(store.getState().save()).toBe(false);
    expect(store.getState().project?.scene.seed).toBe(1);
    expect(saved).toEqual([]);
  });

  it("un borrador cuenta como trabajo sin guardar y se borra al salir sin guardar", () => {
    const store = make();
    store.getState().open(project("d"), false, { draft: true });
    expect(hasUnsavedWork(store.getState())).toBe(true);
    store.getState().close();
    expect(removed).toEqual(["d"]);
    expect(saved).toEqual([]);
  });

  it("un borrador guardado deja de ser borrador y no se borra al cerrar", () => {
    const store = make();
    store.getState().open(project("d"), false, { draft: true });
    store.getState().save();
    expect(hasUnsavedWork(store.getState())).toBe(false);
    store.getState().close();
    expect(removed).toEqual([]);
  });

  it("abrir otro proyecto descarta el anterior sin guardarlo", () => {
    const store = make();
    store.getState().open(project("a"), false);
    store.getState().rename("NUEVO");
    store.getState().open(project("b"), false);
    expect(saved).toEqual([]);
    expect(store.getState().project?.id).toBe("b");
    expect(store.getState().saveStatus.state).toBe("saved");
  });

  it("rename rechaza un nombre vacío", () => {
    const store = make();
    store.getState().open(project(), false);
    expect(store.getState().rename("   ")).toBe(false);
  });
});
