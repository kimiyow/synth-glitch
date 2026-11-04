import { produce, type Draft } from "immer";
import { createStore } from "zustand/vanilla";

import { normalizeName } from "../project/storage";
import type { Project, Scene } from "./types";
import { change, EMPTY_HISTORY, redo, undo, type UndoHistory } from "./undo";

/**
 * Guardado manual (decisión de producto, sustituye a PRJ-02): nada se escribe en disco
 * hasta que se toca "Guardar proyecto". `unsaved` = hay cambios sin guardar.
 */
export type SaveStatus = { state: "saved" } | { state: "unsaved" } | { state: "error"; error: string };

export type SceneState = {
  /** Proyecto activo (ADR-06: vive en el store, no en la ruta). */
  project: Project | null;
  readOnly: boolean;
  /**
   * Proyecto recién creado que aún no se guarda: su carpeta tiene el medio pero no
   * `project.json`, no sale en la Galería y se borra si se sale sin guardar.
   */
  draft: boolean;
  saveStatus: SaveStatus;
  /** Deshacer y rehacer de la escena (3.8); no incluye el nombre del proyecto. */
  history: UndoHistory;
  /** Abre un proyecto y descarta el anterior sin guardar (quien llama ya preguntó). */
  open(project: Project, readOnly: boolean, opts?: { draft?: boolean }): void;
  /** Cierra sin guardar; un borrador se elimina. */
  close(): void;
  /** Un cambio confirmado de la escena (3.8): entra al historial y queda sin guardar. */
  commit(label: string, recipe: (draft: Draft<Scene>) => void): void;
  /** Cambio que no entra al historial (p. ej. el tempo, 3.8) pero también queda sin guardar. */
  adjust(recipe: (draft: Draft<Scene>) => void): void;
  undo(): void;
  redo(): void;
  /** Devuelve false si el nombre queda vacío o el proyecto es de solo lectura. */
  rename(name: string): boolean;
  /** "Guardar proyecto": escribe `project.json`. Devuelve false si falló. */
  save(): boolean;
  /** El proyecto activo se eliminó: se descarta sin guardar. */
  discard(): void;
};

/** True si salir ahora perdería trabajo: cambios sin guardar o un borrador nunca guardado. */
export function hasUnsavedWork(state: Pick<SceneState, "project" | "readOnly" | "draft" | "saveStatus">): boolean {
  if (!state.project || state.readOnly) return false;
  return state.draft || state.saveStatus.state !== "saved";
}

export type SceneStoreDeps = {
  save: (project: Project) => void;
  /** Borra la carpeta de un borrador que se abandona sin guardar. */
  removeDraft?: (id: string) => void;
  now?: () => Date;
};

export function createSceneStore(deps: SceneStoreDeps) {
  const now = deps.now ?? (() => new Date());

  return createStore<SceneState>()((set, get) => {
    const update = (project: Project) => set({ project, saveStatus: { state: "unsaved" } });

    /** Al dejar el proyecto activo sin guardar, un borrador no debe quedar en disco. */
    const dropDraft = () => {
      const { project, draft } = get();
      if (project && draft) deps.removeDraft?.(project.id);
    };

    return {
      project: null,
      readOnly: false,
      draft: false,
      saveStatus: { state: "saved" },
      history: EMPTY_HISTORY,
      open(project, readOnly, opts) {
        if (get().project?.id !== project.id) dropDraft();
        const draft = opts?.draft ?? false;
        set({ project, readOnly, draft, saveStatus: { state: draft ? "unsaved" : "saved" }, history: EMPTY_HISTORY });
      },
      close() {
        dropDraft();
        set({ project: null, readOnly: false, draft: false, saveStatus: { state: "saved" }, history: EMPTY_HISTORY });
      },
      commit(label, recipe) {
        const { project, readOnly, history } = get();
        if (!project || readOnly) return;
        const result = change(project.scene, history, label, recipe);
        if (result.history === history) return;
        set({ history: result.history });
        update({ ...project, scene: result.value, updatedAt: now().toISOString() });
      },
      adjust(recipe) {
        const { project, readOnly } = get();
        if (!project || readOnly) return;
        update({ ...project, scene: produce(project.scene, recipe), updatedAt: now().toISOString() });
      },
      undo() {
        const { project, readOnly, history } = get();
        const result = project && !readOnly ? undo(project.scene, history) : null;
        if (!project || !result) return;
        set({ history: result.history });
        update({ ...project, scene: result.value, updatedAt: now().toISOString() });
      },
      redo() {
        const { project, readOnly, history } = get();
        const result = project && !readOnly ? redo(project.scene, history) : null;
        if (!project || !result) return;
        set({ history: result.history });
        update({ ...project, scene: result.value, updatedAt: now().toISOString() });
      },
      rename(name) {
        const { project, readOnly } = get();
        const clean = normalizeName(name);
        if (!project || readOnly || !clean) return false;
        if (clean !== project.name) update({ ...project, name: clean, updatedAt: now().toISOString() });
        return true;
      },
      save() {
        const { project, readOnly } = get();
        if (!project || readOnly) return false;
        try {
          deps.save(project);
          set({ draft: false, saveStatus: { state: "saved" } });
          return true;
        } catch (error) {
          set({ saveStatus: { state: "error", error: error instanceof Error ? error.message : String(error) } });
          return false;
        }
      },
      discard() {
        set({ project: null, readOnly: false, draft: false, saveStatus: { state: "saved" }, history: EMPTY_HISTORY });
      },
    };
  });
}

export type SceneStore = ReturnType<typeof createSceneStore>;
