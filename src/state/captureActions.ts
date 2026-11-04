import { Skia, type SkImage } from "@shopify/react-native-skia";
import { getThumbnailAsync } from "expo-video-thumbnails";

import { PREVIEW_LONG_SIDE, renderSceneJpeg, THUMB_LONG_SIDE } from "../editor/renderPreviews";
import { cropRectFor } from "../engine/crop";
import { createProject } from "../project/schema";
import { createProjectFiles, newProjectId } from "../project/storage";
import { projectFs, sceneStore } from "./activeScene";
import type { CropAspect, Project } from "./types";

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
  kind: "photo" | "clip";
  sourceUri: string;
  fileName: string;
  /** Imagen con la que se generan preview y miniatura (la foto o el primer cuadro del clip). */
  poster: SkImage;
  aspect: CropAspect;
}): Promise<Result> {
  const now = new Date();
  const width = args.poster.width();
  const height = args.poster.height();
  const base = createProject({
    id: newProjectId(now),
    media: { kind: args.kind, file: args.fileName, width, height },
    seed: Math.floor(Math.random() * 2 ** 31),
    now,
  });
  const project: Project = {
    ...base,
    scene: { ...base.scene, crop: { aspect: args.aspect, rect: cropRectFor(width, height, args.aspect) } },
  };
  const preview = await renderSceneJpeg(args.poster, project.scene, PREVIEW_LONG_SIDE);
  const thumb = await renderSceneJpeg(args.poster, project.scene, THUMB_LONG_SIDE, 80);
  createProjectFiles(projectFs, project, {
    media: { name: args.fileName, sourceUri: args.sourceUri },
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
      return await createFromMedia({ kind: "photo", sourceUri: uri, fileName: `media.${extensionOf(uri, "jpg")}`, poster, aspect });
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
      return await createFromMedia({ kind: "clip", sourceUri: uri, fileName: `media.${extensionOf(uri, "mp4")}`, poster, aspect });
    } finally {
      poster.dispose();
    }
  });
}
