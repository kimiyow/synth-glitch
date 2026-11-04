import { drawAsImage, ImageFormat, Skia, type SkImage } from "@shopify/react-native-skia";
import { createElement } from "react";

import { croppedSize, fitLongSide } from "../engine/crop";
import { renderPainted } from "../paint/brushEngine";
import { GENERATOR_BY_ID } from "../engine/registry";
import type { GeneratorId, Layer, Scene } from "../state/types";
import { SceneRenderer } from "./SceneRenderer";

export const PREVIEW_LONG_SIDE = 2048;
export const THUMB_LONG_SIDE = 400;

/** Renderiza la escena recortada (mismo árbol que el preview) y la codifica como JPEG. */
export async function renderSceneJpeg(image: SkImage, scene: Scene, longSide: number, quality = 90): Promise<Uint8Array> {
  const size = fitLongSide(croppedSize(image.width(), image.height(), scene.crop.rect), longSide);
  // La pintura se reproduce desde los trazos a la resolución de salida (3.4, BRU-07).
  const paintLongSide = Math.min(4096, Math.ceil(longSide / Math.max(scene.crop.rect[2], scene.crop.rect[3])));
  const source = renderPainted(image, scene.paint.strokes, paintLongSide);
  const element = createElement(SceneRenderer, {
    image: source,
    width: size.width,
    height: size.height,
    layers: scene.layers,
    seed: scene.seed,
    frame: { time: 0, params: [] },
    crop: scene.crop.rect,
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

let blank: SkImage | null = null;

/** Imagen negra de 1×1 para los generadores en `replace`, que no leen su entrada. */
export function blankImage(): SkImage {
  if (!blank) {
    const surface = Skia.Surface.Make(1, 1);
    if (!surface) throw new Error("NO SE PUDO CREAR LA SUPERFICIE");
    surface.getCanvas().clear(Skia.Color("black"));
    blank = surface.makeImageSnapshot();
  }
  return blank;
}

export function generatorLayer(generator: GeneratorId): Layer {
  const def = GENERATOR_BY_ID[generator];
  return { kind: "generator", id: generator, generator, params: { ...def.defaults }, visible: true, blend: "replace" };
}

/**
 * Cuadro fijo de un generador (CAM-06 con base congelada): se guarda como el medio del
 * proyecto generativo, así pincel, efectos y exportación lo tratan como una foto.
 */
export async function renderGeneratorJpeg(generator: GeneratorId, width: number, height: number, seed: number): Promise<Uint8Array> {
  const element = createElement(SceneRenderer, {
    image: blankImage(),
    width,
    height,
    layers: [generatorLayer(generator)],
    seed,
    frame: { time: 0, params: [] },
  });
  const rendered = await drawAsImage(element, { width, height });
  if (!rendered) throw new Error("NO SE PUDO RENDERIZAR EL GENERADOR");
  try {
    const bytes = rendered.encodeToBytes(ImageFormat.JPEG, 95);
    if (bytes.length === 0) throw new Error("NO SE PUDO CODIFICAR EL GENERADOR");
    return bytes;
  } finally {
    rendered.dispose();
  }
}
