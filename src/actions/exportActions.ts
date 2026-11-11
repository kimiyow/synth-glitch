import { Skia, type SkImage } from "@shopify/react-native-skia";
import { getThumbnailAsync } from "expo-video-thumbnails";
import { applyPalette, GIFEncoder, quantize } from "gifenc";

import { createFrameRenderer, exportLongSide, renderSceneJpeg, sceneFrameAt } from "../render/renderPreviews";
import { GIF_FPS, gifDurationS, gifFrameCount } from "../modulation/gifTiming";
import { saveToPhotos, writeExportFile } from "../platform/photos";
import { pickSynthFxFile, shareSynthFxFile } from "../platform/synthfxFile";
import { applySynthFx, createSynthFx, parseSynthFx, serializeSynthFx, synthFxFileName } from "../project/synthfx";
import { projectFs, sceneStore } from "../state/activeScene";
import type { Project } from "../domain/types";

export type ExportResult = { ok: true; uri: string; ms: number } | { ok: false; error: string };

// nombre de archivo exportado a partir del nombre del proyecto
export function exportFileName(project: Project, extension: "jpg" | "gif"): string {
  return synthFxFileName(project.name).replace(/\.synthfx$/, `.${extension}`);
}

// original del proyecto decodificado: la foto, la base generativa o el primer cuadro del clip
export async function loadOriginal(project: Project): Promise<SkImage> {
  const file = project.scene.media.file;
  if (!file) throw new Error("EL PROYECTO NO TIENE IMAGEN");
  let uri = projectFs.uri(project.id, file);
  if (project.scene.media.kind === "clip") uri = (await getThumbnailAsync(uri, { time: 0, quality: 1 })).uri;
  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  if (!image) throw new Error("NO SE PUDO LEER LA IMAGEN");
  return image;
}

// JPG a resolución original (≤ 4096 px de lado largo) con recorte, pintura reproducida y capas con
// sus valores en el instante t (los mismos que el preview)
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

// lado largo del GIF
export const GIF_LONG_SIDE = 480;

export class ExportCancelled extends Error {}

// GIF de fotos y generativos, 480 px, 12 fps, hasta 4 s. Las fuentes en vivo se congelan y solo
// anima lo que depende del tiempo. Se codifica en JS cuadro a cuadro, cediendo el hilo entre
// cuadros para que la interfaz siga respondiendo y se pueda cancelar
export async function exportGif(
  project: Project,
  opts: { onProgress: (p: number) => void; isCancelled: () => boolean },
): Promise<ExportResult | { ok: false; cancelled: true }> {
  try {
    const start = Date.now();
    const { scene } = project;
    const frames = gifFrameCount(gifDurationS(scene.layers, scene.routes, scene.sources));
    const delay = Math.round(1000 / GIF_FPS);
    const image = await loadOriginal(project);
    const renderer = createFrameRenderer(image, scene, GIF_LONG_SIDE);
    const gif = GIFEncoder();
    try {
      for (let i = 0; i < frames; i++) {
        if (opts.isCancelled()) throw new ExportCancelled();
        const rgba = await renderer.render(sceneFrameAt(scene, i / GIF_FPS));
        // rgb444 cuantiza más rápido que rgb565 y basta a 480 px
        const palette = quantize(rgba, 256, { format: "rgb444" });
        const index = applyPalette(rgba, palette, "rgb444");
        gif.writeFrame(index, renderer.size.width, renderer.size.height, { palette, delay, repeat: 0 });
        opts.onProgress((i + 1) / frames);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      renderer.dispose();
      image.dispose();
    }
    gif.finish();
    const uri = writeExportFile(exportFileName(project, "gif"), gif.bytes());
    const saved = await saveToPhotos(uri);
    if (!saved.ok) return saved;
    return { ok: true, uri, ms: Date.now() - start };
  } catch (error) {
    if (error instanceof ExportCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export type RecipeImport = { ok: true; name: string; lastLayerId: string | null } | { ok: false; error: string } | { ok: "cancelled" };

// receta .synthfx: el usuario elige un archivo y se aplica a la escena como un solo cambio
export async function importRecipe(): Promise<RecipeImport> {
  const picked = await pickSynthFxFile();
  if (picked.kind === "rejected") return { ok: false, error: picked.message };
  if (picked.kind !== "picked") return { ok: "cancelled" };
  const parsed = parseSynthFx(picked.text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  sceneStore.getState().commit("importar receta", (scene) => applySynthFx(scene, parsed.value));
  return { ok: true, name: parsed.value.name, lastLayerId: parsed.value.layers.at(-1)?.id ?? null };
}

// comparte la receta de la escena por la hoja de compartir
export function shareRecipe(project: Project): Promise<void> {
  return shareSynthFxFile(synthFxFileName(project.name), serializeSynthFx(createSynthFx(project.name, project.scene)));
}
