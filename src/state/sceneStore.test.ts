import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { createProject } from "../project/schema";
import type { Project } from "./types";
import { createSceneStore } from "./sceneStore";

const T0 = new Date(Date.UTC(2026, 10, 3, 10));
const T1 = new Date(Date.UTC(2026, 10, 3, 11));
const project = (id = "p"): Project =>
  createProject({ id, media: { kind: "generative", width: 1, height: 1 }, seed: 1, now: T0 });

describe("sceneStore", () => {
  let saved: Project[];
  beforeEach(() => {
    jest.useFakeTimers();
    saved = [];
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const make = () => createSceneStore({ save: (p) => saved.push(p), now: () => T1 });

  it("un cambio confirmado actualiza la escena y se autoguarda a 1 s", () => {
    const store = make();
    store.getState().open(project(), false);
    store.getState().commit((s) => ({ ...s, seed: 99 }));
    expect(store.getState().saveStatus.state).toBe("pending");
    expect(store.getState().project?.updatedAt).toBe(T1.toISOString());
    jest.advanceTimersByTime(1000);
    expect(saved.map((p) => p.scene.seed)).toEqual([99]);
    expect(store.getState().saveStatus.state).toBe("saved");
  });

  it("no cambia ni guarda un proyecto de solo lectura", () => {
    const store = make();
    store.getState().open(project(), true);
    store.getState().commit((s) => ({ ...s, seed: 99 }));
    expect(store.getState().rename("X")).toBe(false);
    jest.advanceTimersByTime(5000);
    expect(store.getState().project?.scene.seed).toBe(1);
    expect(saved).toEqual([]);
  });

  it("abrir otro proyecto guarda antes lo pendiente del anterior", () => {
    const store = make();
    store.getState().open(project("a"), false);
    store.getState().rename("NUEVO");
    store.getState().open(project("b"), false);
    expect(saved.map((p) => [p.id, p.name])).toEqual([["a", "NUEVO"]]);
    expect(store.getState().project?.id).toBe("b");
  });

  it("descartar no guarda", () => {
    const store = make();
    store.getState().open(project(), false);
    store.getState().commit((s) => ({ ...s, seed: 2 }));
    store.getState().discard();
    jest.advanceTimersByTime(5000);
    expect(saved).toEqual([]);
    expect(store.getState().project).toBeNull();
  });

  it("rename rechaza un nombre vacío", () => {
    const store = make();
    store.getState().open(project(), false);
    expect(store.getState().rename("   ")).toBe(false);
  });
});
