import { AlphaType, ColorType, drawAsImage, ImageFormat, Skia, type SkImage } from "@shopify/react-native-skia";
import { createElement } from "react";

import { croppedSize, fitLongSide } from "../engine/crop";
import { buildLayerChain, type FrameInputs } from "../engine/renderGraph";
import { evaluate, NO_INPUTS } from "../modulation/evaluate";
import { renderPaintMask, renderPainted } from "../paint/brushEngine";
import { GENERATOR_BY_ID } from "../engine/registry";
import type { GeneratorId, Layer, Scene } from "../domain/types";
import { hasPaint, paintChainIndex } from "../paint/paintStack";
import { SceneRenderer, type PaintInput } from "./SceneRenderer";

export const PREVIEW_LONG_SIDE = 2048;
export const THUMB_LONG_SIDE = 400;

// lado largo máximo de una exportación
export const EXPORT_MAX_LONG_SIDE = 4096;

// parámetros efectivos de la escena en el instante t (s), como en el preview pero con las entradas
// en vivo congeladas en su valor base (dedo, giro, micrófono)
export function sceneFrameAt(scene: Scene, t: number): FrameInputs {
  const chain = buildLayerChain(scene.layers).map((n) => ({ id: n.layerId, params: n.base }));
  return { time: t, params: evaluate(chain, scene.routes, scene.sources, t, NO_INPUTS, scene.seed) };
}

// lado largo de la exportación a resolución original: la región recortada, hasta 4096 px
export function exportLongSide(image: SkImage, scene: Scene): number {
  const size = croppedSize(image.width(), image.height(), scene.crop.rect);
  return Math.min(EXPORT_MAX_LONG_SIDE, Math.max(size.width, size.height));
}

// renderiza la escena recortada (mismo árbol que el preview) y la codifica como JPEG
export async function renderSceneJpeg(
  image: SkImage,
  scene: Scene,
  longSide: number,
  quality = 90,
  frame: FrameInputs = { time: 0, params: [] },
): Promise<Uint8Array> {
  const size = fitLongSide(croppedSize(image.width(), image.height(), scene.crop.rect), longSide);
  // la pintura se reproduce desde los trazos a la resolución de salida
  const paintLongSide = Math.min(4096, Math.ceil(longSide / Math.max(scene.crop.rect[2], scene.crop.rect[3])));
  const paint = paintInput(image, scene, paintLongSide);
  const element = createElement(SceneRenderer, {
    image,
    width: size.width,
    height: size.height,
    layers: scene.layers,
    seed: scene.seed,
    frame,
    crop: scene.crop.rect,
    paint: paint?.input,
  });
  // la imagen pintada es temporal; a 4096 px no liberarla acumula memoria
  const rendered = await drawAsImage(element, size).finally(() => paint?.dispose());
  if (!rendered) throw new Error("NO SE PUDO RENDERIZAR LA VISTA PREVIA");
  try {
    const bytes = rendered.encodeToBytes(ImageFormat.JPEG, quality);
    if (bytes.length === 0) throw new Error("NO SE PUDO CODIFICAR LA VISTA PREVIA");
    return bytes;
  } finally {
    rendered.dispose();
  }
}

// capa PINTURA reproducida desde los trazos (null si no tiene trazos o está oculta)
function paintInput(image: SkImage, scene: Scene, longSide: number): { input: PaintInput; dispose: () => void } | null {
  const { paint } = scene;
  if (!hasPaint(paint) || !paint.visible) return null;
  const painted = renderPainted(image, paint.strokes, longSide);
  const mask = renderPaintMask(image, paint.strokes, longSide);
  if (!mask) return null;
  return {
    input: { image: painted, mask, at: paintChainIndex(scene.layers, paint.index) },
    dispose() {
      if (painted !== image) painted.dispose();
      mask.dispose();
    },
  };
}

let blank: SkImage | null = null;

// imagen negra de 1×1 para los generadores en replace, que no leen su entrada
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

// cuadro fijo de un generador (base congelada): se guarda como el medio del proyecto generativo,
// así pincel, efectos y exportación lo tratan como una foto
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

// render de cuadros para el GIF: la pintura se reproduce una vez a la resolución de salida y cada
// cuadro usa el mismo árbol que el preview. Devuelve RGBA 8888
export function createFrameRenderer(image: SkImage, scene: Scene, longSide: number) {
  const size = fitLongSide(croppedSize(image.width(), image.height(), scene.crop.rect), longSide);
  const paintLongSide = Math.min(4096, Math.ceil(longSide / Math.max(scene.crop.rect[2], scene.crop.rect[3])));
  const paint = paintInput(image, scene, paintLongSide);
  const info = { width: size.width, height: size.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  return {
    size,
    async render(frame: FrameInputs): Promise<Uint8Array> {
      const element = createElement(SceneRenderer, {
        image,
        width: size.width,
        height: size.height,
        layers: scene.layers,
        seed: scene.seed,
        frame,
        crop: scene.crop.rect,
        paint: paint?.input,
      });
      const rendered = await drawAsImage(element, size);
      if (!rendered) throw new Error("NO SE PUDO RENDERIZAR EL CUADRO");
      try {
        const pixels = rendered.readPixels(0, 0, info);
        if (!(pixels instanceof Uint8Array)) throw new Error("NO SE PUDIERON LEER LOS PÍXELES");
        return pixels;
      } finally {
        rendered.dispose();
      }
    },
    dispose() {
      paint?.dispose();
    },
  };
}
