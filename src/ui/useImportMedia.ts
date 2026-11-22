import { router } from "expo-router";
import { useState } from "react";

import { createProjectFromClip, createProjectFromPhoto } from "../actions/captureActions";
import { confirmLeave } from "../actions/leaveGuard";
import { pickMediaFromLibrary } from "../platform/pickMedia";
import { reportError } from "./errors";

// importar de Fotos y abrir el proyecto: lo usan el editor vacío y la cámara. Las importaciones no
// se recortan (aspecto libre)
export function useImportMedia() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const importMedia = async (): Promise<void> => {
    if (busy) return;
    // desde la cámara puede haber un proyecto abierto con cambios
    if (!(await confirmLeave())) return;
    setBusy(true);
    setMessage(null);
    try {
      const picked = await pickMediaFromLibrary();
      if (picked.kind === "rejected") setMessage(picked.message);
      if (picked.kind === "selected") {
        const { uri, type: kind } = picked.media;
        const result = kind === "clip" ? await createProjectFromClip(uri, "free") : await createProjectFromPhoto(uri, "free");
        if (result.ok) router.push("/project");
        else void reportError({ title: "No se pudo importar", error: result.error, retry: importMedia });
      }
    } catch (error) {
      void reportError({ title: "No se pudo importar", error, retry: importMedia });
    } finally {
      setBusy(false);
    }
  };

  return { busy, message, setMessage, importMedia };
}
