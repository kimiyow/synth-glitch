import { Skia, type SkImage } from "@shopify/react-native-skia";
import { getThumbnailAsync } from "expo-video-thumbnails";

import { PREVIEW_LONG_SIDE, renderGeneratorJpeg, renderSceneJpeg, THUMB_LONG_SIDE } from "../render/renderPreviews";
import { cropRectFor } from "../engine/crop";
import { GENERATOR_BY_ID } from "../engine/registry";
import { createProject, createScene } from "../project/schema";
import { createProjectFiles, newProjectId } from "../project/storage";
import { projectFs, sceneStore } from "../state/activeScene";
import type { CropAspect, GeneratorId, Project, SourceConfig } from "../domain/types";

type Result = { ok: true; project: Project } | { ok: false; error: string };

async function decode(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error("NO SE PUDO LEER LA IMAGEN");
  return image;
}

function extensionOf(uri: string, fallback: string) {
  const match = /\.([a-z0-9]{2,4})(?:\?|$)/i.exec(uri);
  return match ? match[1].toLowerCase() : fallback;
}

// crea un proyecto con el medio copiado, recorte no destructivo, vista previa y miniatura, y lo
// deja abierto en el store
async function createFromMedia(args: {
  kind: "photo" | "clip" | "generative";
  // el medio se copia desde un archivo (foto, clip) o se escribe desde bytes (generativo)
  source: { sourceUri: string } | { bytes: Uint8Array };
  fileName: string;
  // imagen con la que se generan preview y miniatura (la foto o el primer cuadro del clip)
  poster: SkImage;
  aspect: CropAspect;
  seed?: number;
  // capas y modulaciones con las que abre (p. ej. el generador en vivo)
  start?: Pick<Project["scene"], "layers" | "routes">;
}): Promise<Result> {
  const now = new Date();
  const width = args.poster.width();
  const height = args.poster.height();
  const base = createProject({
    id: newProjectId(now),
    media: { kind: args.kind, file: args.fileName, width, height },
    seed: args.seed ?? Math.floor(Math.random() * 2 ** 31),
    now,
  });
  const project: Project = {
    ...base,
    scene: { ...base.scene, ...args.start, crop: { aspect: args.aspect, rect: cropRectFor(width, height, args.aspect) } },
  };
  const preview = await renderSceneJpeg(args.poster, project.scene, PREVIEW_LONG_SIDE);
  const thumb = await renderSceneJpeg(args.poster, project.scene, THUMB_LONG_SIDE, 80);
  // borrador: no sale en la Galería hasta que se toca "Guardar proyecto"
  createProjectFiles(projectFs, project, { media: { name: args.fileName, ...args.source }, preview, thumb }, { draft: true });
  sceneStore.getState().open(project, false, { draft: true });
  return { ok: true, project };
}

async function guard(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function createProjectFromPhoto(uri: string, aspect: CropAspect): Promise<Result> {
  return guard(async () => {
    const poster = await decode(uri);
    try {
      return await createFromMedia({ kind: "photo", source: { sourceUri: uri }, fileName: `media.${extensionOf(uri, "jpg")}`, poster, aspect });
    } finally {
      poster.dispose();
    }
  });
}

export function createProjectFromClip(uri: string, aspect: CropAspect): Promise<Result> {
  return guard(async () => {
    const frame = await getThumbnailAsync(uri, { time: 0, quality: 1 });
    const poster = await decode(frame.uri);
    try {
      return await createFromMedia({ kind: "clip", source: { sourceUri: uri }, fileName: `media.${extensionOf(uri, "mp4")}`, poster, aspect });
    } finally {
      poster.dispose();
    }
  });
}

// resolución de un proyecto generativo por aspecto (lado largo ≤ 1920 px)
export const GENERATIVE_SIZE: Record<Exclude<CropAspect, "free">, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1440, height: 1440 },
  "4:5": { width: 1440, height: 1800 },
};

// generador en vivo sobre su cuadro fijo: se mueve con su propia velocidad (eje Y) y un LFO lento
// hace respirar el eje X. Es una capa y una modulación normales: se ajustan o quitan en Capas
const LIVE_LFO_HZ = 0.2;
const LIVE_LFO_AMOUNT = 0.3;

function liveGeneratorStart(generator: GeneratorId, sources: SourceConfig): Pick<Project["scene"], "layers" | "routes"> {
  const layerId = `${generator}-vivo`;
  return {
    layers: [{ kind: "generator", id: layerId, generator, params: { ...GENERATOR_BY_ID[generator].defaults }, visible: true, blend: "replace" }],
    routes: [
      {
        id: `mod-${layerId}`,
        source: "lfo",
        sourceIndex: 0,
        target: { layerId, param: "x" },
        amount: LIVE_LFO_AMOUNT,
        curve: "lin",
        mode: "add",
        settings: { lfo: { ...sources.lfo, rateHz: LIVE_LFO_HZ } },
      },
    ],
  };
}

// proyecto sin imagen; la base es un cuadro fijo del generador elegido. Animado = además el
// generador en vivo con su modulación
export function createGenerativeProject(aspect: Exclude<CropAspect, "free">, generator: GeneratorId, animated = false): Promise<Result> {
  return guard(async () => {
    const { width, height } = GENERATIVE_SIZE[aspect];
    const seed = Math.floor(Math.random() * 2 ** 31);
    const bytes = await renderGeneratorJpeg(generator, width, height, seed);
    const poster = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
    if (!poster) throw new Error("NO SE PUDO LEER EL GENERADOR");
    try {
      const start = animated ? liveGeneratorStart(generator, createScene({ kind: "generative", width, height }, seed).sources) : undefined;
      return await createFromMedia({ kind: "generative", source: { bytes }, fileName: "media.jpg", poster, aspect, seed, start });
    } finally {
      poster.dispose();
    }
  });
}
