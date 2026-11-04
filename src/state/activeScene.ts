import { AppState } from "react-native";
import { useStore } from "zustand";

import { createExpoProjectFs } from "../project/expoProjectFs";
import { saveProject } from "../project/storage";
import { createSceneStore, type SceneState } from "./sceneStore";

/** Sistema de archivos de proyectos de la app. */
export const projectFs = createExpoProjectFs();

/** Store de la escena de la app, con autoguardado a disco. */
export const sceneStore = createSceneStore({ save: (project) => saveProject(projectFs, project) });

// Al pasar a segundo plano se guarda lo pendiente sin esperar el segundo.
AppState.addEventListener("change", (state) => {
  if (state !== "active") sceneStore.getState().flush();
});

export function useScene<T>(selector: (state: SceneState) => T): T {
  return useStore(sceneStore, selector);
}
