import type { Draft } from "immer";
import { createStore } from "zustand/vanilla";

import { createAutosave, type SaveStatus } from "../project/autosave";
import { normalizeName } from "../project/storage";
import type { Project, Scene } from "./types";
import { change, EMPTY_HISTORY, redo, undo, type UndoHistory } from "./undo";

export type SceneState = {
  /** Proyecto activo (ADR-06: vive en el store, no en la ruta). */
  project: Project | null;
  readOnly: boolean;
  saveStatus: SaveStatus;
  /** Deshacer y rehacer de la escena (3.8); no incluye el nombre del proyecto. */
  history: UndoHistory;
  /** Abre un proyecto; antes guarda lo pendiente del anterior. */
  open(project: Project, readOnly: boolean): void;
  close(): void;
  /** Un cambio confirmado de la escena (3.8): entra al historial y se autoguarda. */
  commit(label: string, recipe: (draft: Draft<Scene>) => void): void;
  undo(): void;
  redo(): void;
  /** Devuelve false si el nombre queda vacío o el proyecto es de solo lectura. */
  rename(name: string): boolean;
  /** Guarda ya lo pendiente (segundo plano, reintentar, salir). */
  flush(): void;
  /** El proyecto activo se eliminó: se descarta sin guardar. */
  discard(): void;
};

export type SceneStoreDeps = {
  save: (project: Project) => void;
  now?: () => Date;
  delayMs?: number;
};

export function createSceneStore(deps: SceneStoreDeps) {
  const now = deps.now ?? (() => new Date());

  return createStore<SceneState>()((set, get) => {
    const autosave = createAutosave({
      write: deps.save,
      onStatus: (saveStatus) => set({ saveStatus }),
      delayMs: deps.delayMs,
    });

    const save = (project: Project) => {
      set({ project });
      autosave.schedule(project);
    };

    return {
      project: null,
      readOnly: false,
      saveStatus: { state: "saved" },
      history: EMPTY_HISTORY,
      open(project, readOnly) {
        autosave.flush();
        set({ project, readOnly, saveStatus: { state: "saved" }, history: EMPTY_HISTORY });
      },
      close() {
        autosave.flush();
        set({ project: null, readOnly: false, history: EMPTY_HISTORY });
      },
      commit(label, recipe) {
        const { project, readOnly, history } = get();
        if (!project || readOnly) return;
        const result = change(project.scene, history, label, recipe);
        if (result.history === history) return;
        set({ history: result.history });
        save({ ...project, scene: result.value, updatedAt: now().toISOString() });
      },
      undo() {
        const { project, readOnly, history } = get();
        const result = project && !readOnly ? undo(project.scene, history) : null;
        if (!project || !result) return;
        set({ history: result.history });
        save({ ...project, scene: result.value, updatedAt: now().toISOString() });
      },
      redo() {
        const { project, readOnly, history } = get();
        const result = project && !readOnly ? redo(project.scene, history) : null;
        if (!project || !result) return;
        set({ history: result.history });
        save({ ...project, scene: result.value, updatedAt: now().toISOString() });
      },
      rename(name) {
        const { project, readOnly } = get();
        const clean = normalizeName(name);
        if (!project || readOnly || !clean) return false;
        save({ ...project, name: clean, updatedAt: now().toISOString() });
        return true;
      },
      flush: () => autosave.flush(),
      discard() {
        autosave.cancel();
        set({ project: null, readOnly: false, saveStatus: { state: "saved" }, history: EMPTY_HISTORY });
      },
    };
  });
}

export type SceneStore = ReturnType<typeof createSceneStore>;
