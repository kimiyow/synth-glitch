import {
  deleteProject,
  duplicateProject,
  listProjects,
  newProjectId,
  readProject,
  renameProject,
  type ProjectSummary,
} from "../project/storage";
import { projectFs, sceneStore } from "./activeScene";

/** Casos de uso de la Galería (PRJ-03). Coordinan el store activo y los archivos. */

type Result = { ok: true } | { ok: false; error: string };

export function listAllProjects(): ProjectSummary[] {
  // Lo pendiente del proyecto abierto se escribe antes, para listar lo último.
  sceneStore.getState().flush();
  return listProjects(projectFs);
}

export function openProjectById(id: string): Result {
  const result = readProject(projectFs, id);
  if (!result.ok) return result;
  sceneStore.getState().open(result.project, result.readOnly);
  return { ok: true };
}

export function renameProjectById(id: string, name: string): Result {
  const store = sceneStore.getState();
  if (store.project?.id === id) {
    if (!store.rename(name)) return { ok: false, error: "NO SE PUDO RENOMBRAR" };
    store.flush();
    return { ok: true };
  }
  const result = renameProject(projectFs, id, name, new Date());
  return result.ok ? { ok: true } : result;
}

export function duplicateProjectById(id: string): Result {
  if (sceneStore.getState().project?.id === id) sceneStore.getState().flush();
  const now = new Date();
  try {
    const result = duplicateProject(projectFs, id, newProjectId(now), now);
    return result.ok ? { ok: true } : result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function deleteProjectById(id: string): Result {
  if (sceneStore.getState().project?.id === id) sceneStore.getState().discard();
  try {
    deleteProject(projectFs, id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
