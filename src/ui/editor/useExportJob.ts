import { useRef, useState } from "react";

import { exportGif, exportJpeg, importRecipe, shareRecipe } from "../../actions/exportActions";
import { saveActiveProject } from "../../actions/leaveGuard";
import type { Project } from "../../domain/types";
import { shareFile } from "../../platform/photos";
import { reportError } from "../errors";
import type { ExportAction, ExportJob } from "./ExportPanel";

// salidas del panel Exportar y del panel Presets. vive en la pantalla y no en el panel, así un GIF
// sigue aunque se cierre el panel
export function useExportJob(project: Project, previewTime: () => number, notify: (text: string) => void) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [recipeBusy, setRecipeBusy] = useState(false);
  const gifCancel = useRef(false);
  // un doble toque llega antes de que el re-render deshabilite los botones: sin esto se guardan dos
  // JPG en Fotos o corren dos GIF a la vez
  const busy = useRef(false);

  const onExportAction = async (action: ExportAction): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    try {
      await runExportAction(action);
    } finally {
      busy.current = false;
    }
  };

  const runExportAction = async (action: ExportAction): Promise<void> => {
    const retry = () => onExportAction(action);
    if (action === "project") {
      const r = await saveActiveProject();
      if (r.ok) return notify("PROYECTO GUARDADO");
      return void reportError({ title: "No se pudo guardar el proyecto", error: r.error, retry });
    }
    if (action === "share") {
      if (lastExport) await shareFile(lastExport).catch((error: unknown) => void reportError({ title: "No se pudo compartir", error, retry }));
      return;
    }
    if (action === "jpg") {
      setJob({ label: "Exportando JPG…", progress: null });
      const r = await exportJpeg(project, previewTime());
      setJob(null);
      if (!r.ok) return void reportError({ title: "No se pudo exportar el JPG", error: r.error, retry });
      setLastExport(r.uri);
      notify(`JPG GUARDADO EN FOTOS · ${(r.ms / 1000).toFixed(1)} S`);
    }
    if (action === "gif") {
      gifCancel.current = false;
      const cancel = () => {
        gifCancel.current = true;
      };
      setJob({ label: "Creando GIF…", progress: 0, onCancel: cancel });
      const r = await exportGif(project, {
        onProgress: (p) => setJob({ label: `Creando GIF… ${Math.round(p * 100)} %`, progress: p, onCancel: cancel }),
        isCancelled: () => gifCancel.current,
      });
      setJob(null);
      if (!r.ok) return "cancelled" in r ? notify("GIF CANCELADO") : void reportError({ title: "No se pudo crear el GIF", error: r.error, retry });
      setLastExport(r.uri);
      notify(`GIF GUARDADO EN FOTOS · ${(r.ms / 1000).toFixed(1)} S`);
    }
  };

  // devuelve la última capa de la receta para seleccionarla
  const onImportRecipe = async (): Promise<string | null> => {
    setRecipeBusy(true);
    try {
      const r = await importRecipe();
      if (r.ok === "cancelled") return null;
      if (!r.ok) {
        void reportError({ title: "No se pudo importar la receta", error: r.error });
        return null;
      }
      notify(`RECETA IMPORTADA · ${r.name.toUpperCase()}`);
      return r.lastLayerId;
    } catch (error) {
      void reportError({ title: "No se pudo importar la receta", error });
      return null;
    } finally {
      setRecipeBusy(false);
    }
  };

  const onShareRecipe = async () => {
    setRecipeBusy(true);
    try {
      await shareRecipe(project);
    } catch (error) {
      void reportError({ title: "No se pudo compartir la receta", error, retry: onShareRecipe });
    } finally {
      setRecipeBusy(false);
    }
  };

  return { job, lastExport, recipeBusy, onExportAction, onImportRecipe, onShareRecipe };
}
