import { useRef, useState } from "react";

import { exportGif, exportJpeg, importRecipe, shareRecipe } from "../../actions/exportActions";
import { saveActiveProject } from "../../actions/leaveGuard";
import type { Project } from "../../domain/types";
import { shareFile } from "../../platform/photos";
import type { ExportAction, ExportJob } from "./ExportPanel";

const errorText = (error: unknown) => `ERROR · ${error instanceof Error ? error.message : String(error)}`;

// salidas del panel Exportar y del panel Presets. vive en la pantalla y no en el panel, así un GIF
// sigue aunque se cierre el panel
export function useExportJob(project: Project, previewTime: () => number, notify: (text: string) => void) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [recipeBusy, setRecipeBusy] = useState(false);
  const gifCancel = useRef(false);

  const onExportAction = async (action: ExportAction) => {
    if (action === "project") {
      const r = await saveActiveProject();
      return notify(r.ok ? "PROYECTO GUARDADO" : `ERROR · ${r.error}`);
    }
    if (action === "share") {
      if (lastExport) await shareFile(lastExport).catch((e: unknown) => notify(`ERROR · ${String(e)}`));
      return;
    }
    if (action === "jpg") {
      setJob({ label: "Exportando JPG…", progress: null });
      const r = await exportJpeg(project, previewTime());
      setJob(null);
      if (!r.ok) return notify(`ERROR · ${r.error}`);
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
      if (!r.ok) return notify("cancelled" in r ? "GIF CANCELADO" : `ERROR · ${r.error}`);
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
        notify(r.error);
        return null;
      }
      notify(`RECETA IMPORTADA · ${r.name.toUpperCase()}`);
      return r.lastLayerId;
    } catch (error) {
      notify(errorText(error));
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
      notify(errorText(error));
    } finally {
      setRecipeBusy(false);
    }
  };

  return { job, lastExport, recipeBusy, onExportAction, onImportRecipe, onShareRecipe };
}
