import { createStore } from "zustand/vanilla";

import { createAutosave, type SaveStatus } from "../project/autosave";
import { normalizeName } from "../project/storage";
import type { Project, Scene } from "./types";

export type SceneState = {
  /** Proyecto activo (ADR-06: vive en el store, no en la ruta). */
  project: Project | null;
  readOnly: boolean;
  saveStatus: SaveStatus;
  /** Abre un proyecto; antes guarda lo pendiente del anterior. */
  open(project: Project, readOnly: boolean): void;
  close(): void;
  /** Un cambio confirmado de la escena (3.8): actualiza la fecha y programa el autoguardado. */
  commit(update: (scene: Scene) => Scene): void;
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

    const change = (project: Project) => {
      set({ project });
      autosave.schedule(project);
    };

    return {
      project: null,
      readOnly: false,
      saveStatus: { state: "saved" },
      open(project, readOnly) {
        autosave.flush();
        set({ project, readOnly, saveStatus: { state: "saved" } });
      },
      close() {
        autosave.flush();
        set({ project: null, readOnly: false });
      },
      commit(update) {
        const { project, readOnly } = get();
        if (!project || readOnly) return;
        change({ ...project, scene: update(project.scene), updatedAt: now().toISOString() });
      },
      rename(name) {
        const { project, readOnly } = get();
        const clean = normalizeName(name);
        if (!project || readOnly || !clean) return false;
        change({ ...project, name: clean, updatedAt: now().toISOString() });
        return true;
      },
      flush: () => autosave.flush(),
      discard() {
        autosave.cancel();
        set({ project: null, readOnly: false, saveStatus: { state: "saved" } });
      },
    };
  });
}

export type SceneStore = ReturnType<typeof createSceneStore>;
