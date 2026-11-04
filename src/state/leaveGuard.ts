import { Skia } from "@shopify/react-native-skia";
import { Alert } from "react-native";

import { PREVIEW_LONG_SIDE, renderSceneJpeg, THUMB_LONG_SIDE } from "../editor/renderPreviews";
import { writeImages } from "../project/storage";
import { projectFs, sceneStore } from "./activeScene";
import { hasUnsavedWork } from "./sceneStore";

type Result = { ok: true } | { ok: false; error: string };

/**
 * "Guardar proyecto": escribe `project.json` y renueva la vista previa y la miniatura de
 * la Galería con la escena actual (fotos y generativos; los clips conservan su cuadro).
 */
export async function saveActiveProject(): Promise<Result> {
  const store = sceneStore.getState();
  if (!store.save()) {
    const status = sceneStore.getState().saveStatus;
    return { ok: false, error: status.state === "error" ? status.error : "NO SE PUDO GUARDAR" };
  }
  const project = sceneStore.getState().project;
  const file = project?.scene.media.file;
  if (!project || !file || project.scene.media.kind === "clip") return { ok: true };
  try {
    const data = await Skia.Data.fromURI(projectFs.uri(project.id, file));
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return { ok: true };
    try {
      const preview = await renderSceneJpeg(image, project.scene, PREVIEW_LONG_SIDE);
      const thumb = await renderSceneJpeg(image, project.scene, THUMB_LONG_SIDE, 80);
      writeImages(projectFs, project.id, { preview, thumb });
    } finally {
      image.dispose();
    }
  } catch (error) {
    // El proyecto ya está guardado; solo la miniatura queda como estaba.
    console.warn("No se pudo renovar la miniatura", error);
  }
  return { ok: true };
}

/**
 * Antes de dejar el proyecto activo (volver, abrir otro, capturar uno nuevo): si hay
 * trabajo sin guardar pregunta Guardar / Salir sin guardar / Cancelar. True = continuar.
 */
export function confirmLeave(): Promise<boolean> {
  if (!hasUnsavedWork(sceneStore.getState())) return Promise.resolve(true);
  const { draft } = sceneStore.getState();
  return new Promise((resolve) => {
    Alert.alert(
      draft ? "¿Guardar el proyecto nuevo?" : "¿Guardar los cambios?",
      draft ? "Si sales sin guardar, el proyecto se descarta." : "Si sales sin guardar, perderás los cambios.",
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        { text: "Salir sin guardar", style: "destructive", onPress: () => resolve(true) },
        {
          text: "Guardar",
          isPreferred: true,
          onPress: () => {
            void saveActiveProject().then((r) => {
              if (!r.ok) Alert.alert("No se pudo guardar", r.error);
              resolve(r.ok);
            });
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
