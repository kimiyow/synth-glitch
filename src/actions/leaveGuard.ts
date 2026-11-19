import { askConfirm } from "../state/confirm";

import { PREVIEW_LONG_SIDE, renderSceneJpeg, sceneFrameAt, THUMB_LONG_SIDE } from "../render/renderPreviews";
import { writeImages } from "../project/storage";
import { projectFs, sceneStore } from "../state/activeScene";
import { loadOriginal } from "./exportActions";
import { hasUnsavedWork } from "../state/sceneStore";

type Result = { ok: true } | { ok: false; error: string };

// "guardar proyecto": escribe project.json y renueva la miniatura de la Galería con la escena
// actual. En fotos y generativos también la vista previa; en clips preview.jpg es el primer cuadro
// limpio (lo usan las fichas de efectos) y no se toca
export async function saveActiveProject(): Promise<Result> {
  const store = sceneStore.getState();
  if (!store.save()) {
    const status = sceneStore.getState().saveStatus;
    return { ok: false, error: status.state === "error" ? status.error : "NO SE PUDO GUARDAR" };
  }
  const project = sceneStore.getState().project;
  if (!project?.scene.media.file) return { ok: true };
  try {
    const image = await loadOriginal(project);
    try {
      const isClip = project.scene.media.kind === "clip";
      // con sus modulaciones aplicadas (como el JPG exportado), no solo los valores base: un GESTO
      // o un reemplazo cambian lo que se ve
      const frame = sceneFrameAt(project.scene, 0);
      const preview = isClip ? undefined : await renderSceneJpeg(image, project.scene, PREVIEW_LONG_SIDE, 90, frame);
      const thumb = await renderSceneJpeg(image, project.scene, THUMB_LONG_SIDE, 80, frame);
      writeImages(projectFs, project.id, { preview, thumb });
    } finally {
      image.dispose();
    }
  } catch (error) {
    // el proyecto ya está guardado; solo la miniatura queda como estaba
    console.warn("No se pudo renovar la miniatura", error);
  }
  return { ok: true };
}

// antes de dejar el proyecto activo (volver, abrir otro, capturar uno nuevo): si hay trabajo sin
// guardar pregunta Guardar / Salir sin guardar / Cancelar. True = continuar
export function confirmLeave(): Promise<boolean> {
  if (!hasUnsavedWork(sceneStore.getState())) return Promise.resolve(true);
  const { draft } = sceneStore.getState();
  return askConfirm({
    section: "PROYECTO",
    title: draft ? "¿Guardar el proyecto nuevo?" : "¿Guardar los cambios?",
    message: draft ? "Si sales sin guardar, el proyecto se descarta." : "Si sales sin guardar, perderás los cambios.",
    actions: [
      { id: "save", label: "Guardar", icon: "checkmark", variant: "primary" },
      { id: "discard", label: "Salir sin guardar", icon: "xmark", variant: "secondary" },
    ],
  }).then(async (id) => {
    if (id === "discard") return true;
    if (id !== "save") return false;
    const r = await saveActiveProject();
    if (!r.ok) await askConfirm({ section: "ERROR", title: "No se pudo guardar el proyecto", message: r.error, actions: [], cancelLabel: "Entendido" });
    return r.ok;
  });
}
