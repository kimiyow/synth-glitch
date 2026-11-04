import { Skia, type SkImage } from "@shopify/react-native-skia";

import { exportLongSide, renderSceneJpeg, sceneFrameAt } from "../editor/renderPreviews";
import { saveToPhotos, writeExportFile } from "../platform/photos";
import { synthFxFileName } from "../project/synthfx";
import { projectFs } from "./activeScene";
import type { Project } from "./types";

export type ExportResult = { ok: true; uri: string; ms: number } | { ok: false; error: string };

/** Nombre de archivo exportado a partir del nombre del proyecto. */
export function exportFileName(project: Project, extension: "jpg" | "gif"): string {
  return synthFxFileName(project.name).replace(/\.synthfx$/, `.${extension}`);
}

/** Original del proyecto (foto o base generativa) decodificado. */
export async function loadOriginal(project: Project): Promise<SkImage> {
  const file = project.scene.media.file;
  if (!file) throw new Error("EL PROYECTO NO TIENE IMAGEN");
  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(projectFs.uri(project.id, file)));
  if (!image) throw new Error("NO SE PUDO LEER LA IMAGEN");
  return image;
}

/**
 * EXP-01: JPG a resolución original (≤ 4096 px de lado largo) con recorte, pintura
 * reproducida y capas con sus valores en el instante `t` (los mismos que el preview).
 */
export async function exportJpeg(project: Project, t: number): Promise<ExportResult> {
  try {
    const start = Date.now();
    const image = await loadOriginal(project);
    let bytes: Uint8Array;
    try {
      bytes = await renderSceneJpeg(image, project.scene, exportLongSide(image, project.scene), 95, sceneFrameAt(project.scene, t));
    } finally {
      image.dispose();
    }
    const uri = writeExportFile(exportFileName(project, "jpg"), bytes);
    const saved = await saveToPhotos(uri);
    if (!saved.ok) return saved;
    return { ok: true, uri, ms: Date.now() - start };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
