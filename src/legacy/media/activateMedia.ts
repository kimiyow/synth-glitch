import { File } from "expo-file-system";

import { useEditorStore, type ActiveMedia } from "../state/editorStore";

export function activateMedia(media: ActiveMedia) {
  const previousMedia = useEditorStore.getState().activeMedia;
  useEditorStore.getState().setActiveMedia(media);

  if (previousMedia?.type !== "clip" || previousMedia.uri === media.uri) {
    return;
  }

  try {
    const previousClip = new File(previousMedia.uri);
    if (previousClip.exists) {
      previousClip.delete();
    }
  } catch (error) {
    console.error("No se pudo limpiar el clip reemplazado.", error);
  }
}
