import { Skia, type SkImage } from "@shopify/react-native-skia";
import { getThumbnailAsync } from "expo-video-thumbnails";

import { PREVIEW_LONG_SIDE, renderGeneratorJpeg, renderSceneJpeg, THUMB_LONG_SIDE } from "../editor/renderPreviews";
import { cropRectFor } from "../engine/crop";
import { createProject } from "../project/schema";
import { createProjectFiles, newProjectId } from "../project/storage";
import { projectFs, sceneStore } from "./activeScene";
import type { CropAspect, GeneratorId, Project } from "./types";

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

/**
 * Crea un proyecto (PRJ-01) con el medio copiado, recorte no destructivo (CAM-04),
 * vista previa y miniatura, y lo deja abierto en el store.
 */
async function createFromMedia(args: {
  kind: "photo" | "clip" | "generative";
  /** El medio se copia desde un archivo (foto, clip) o se escribe desde bytes (generativo). */
  source: { sourceUri: string } | { bytes: Uint8Array };
  fileName: string;
  /** Imagen con la que se generan preview y miniatura (la foto o el primer cuadro del clip). */
  poster: SkImage;
  aspect: CropAspect;
  seed?: number;
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
    scene: { ...base.scene, crop: { aspect: args.aspect, rect: cropRectFor(width, height, args.aspect) } },
  };
  const preview = await renderSceneJpeg(args.poster, project.scene, PREVIEW_LONG_SIDE);
  const thumb = await renderSceneJpeg(args.poster, project.scene, THUMB_LONG_SIDE, 80);
  createProjectFiles(projectFs, project, {
    media: { name: args.fileName, ...args.source },
    preview,
    thumb,
  });
  sceneStore.getState().open(project, false);
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

/** Resolución de un proyecto generativo por aspecto (lado largo ≤ 1920 px). */
export const GENERATIVE_SIZE: Record<Exclude<CropAspect, "free">, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1440, height: 1440 },
  "4:5": { width: 1440, height: 1800 },
};

/** CAM-06: proyecto sin imagen; la base es un cuadro fijo del generador elegido. */
export function createGenerativeProject(aspect: Exclude<CropAspect, "free">, generator: GeneratorId): Promise<Result> {
  return guard(async () => {
    const { width, height } = GENERATIVE_SIZE[aspect];
    const seed = Math.floor(Math.random() * 2 ** 31);
    const bytes = await renderGeneratorJpeg(generator, width, height, seed);
    const poster = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
    if (!poster) throw new Error("NO SE PUDO LEER EL GENERADOR");
    try {
      return await createFromMedia({ kind: "generative", source: { bytes }, fileName: "media.jpg", poster, aspect, seed });
    } finally {
      poster.dispose();
    }
  });
}
