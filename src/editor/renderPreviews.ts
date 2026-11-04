import { drawAsImage, ImageFormat, type SkImage } from "@shopify/react-native-skia";
import { createElement } from "react";

import type { Scene } from "../state/types";
import { SceneRenderer } from "./SceneRenderer";

export const PREVIEW_LONG_SIDE = 2048;
export const THUMB_LONG_SIDE = 400;

/** Tamaño con el lado largo `longSide`, sin agrandar la imagen original. */
export function fitLongSide(width: number, height: number, longSide: number) {
  const scale = Math.min(1, longSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Renderiza la escena (mismo árbol que el preview) y la codifica como JPEG. */
export async function renderSceneJpeg(image: SkImage, scene: Scene, longSide: number, quality = 90): Promise<Uint8Array> {
  const size = fitLongSide(image.width(), image.height(), longSide);
  const element = createElement(SceneRenderer, {
    image,
    width: size.width,
    height: size.height,
    layers: scene.layers,
    seed: scene.seed,
    frame: { time: 0, params: [] },
  });
  const rendered = await drawAsImage(element, size);
  if (!rendered) throw new Error("NO SE PUDO RENDERIZAR LA VISTA PREVIA");
  try {
    const bytes = rendered.encodeToBytes(ImageFormat.JPEG, quality);
    if (bytes.length === 0) throw new Error("NO SE PUDO CODIFICAR LA VISTA PREVIA");
    return bytes;
  } finally {
    rendered.dispose();
  }
}
