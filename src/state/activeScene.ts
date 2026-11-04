import { useStore } from "zustand";

import { createExpoProjectFs } from "../project/expoProjectFs";
import { removeDrafts, saveProject } from "../project/storage";
import { createSceneStore, type SceneState } from "./sceneStore";

/** Sistema de archivos de proyectos de la app. */
export const projectFs = createExpoProjectFs();

/** Store de la escena de la app. Guardado manual: solo escribe con "Guardar proyecto". */
export const sceneStore = createSceneStore({
  save: (project) => saveProject(projectFs, project),
  removeDraft: (id) => projectFs.removeDir(id),
});

// Proyectos creados y nunca guardados en una sesión anterior.
try {
  removeDrafts(projectFs);
} catch (error) {
  console.warn("No se pudieron limpiar los borradores", error);
}

export function useScene<T>(selector: (state: SceneState) => T): T {
  return useStore(sceneStore, selector);
}
