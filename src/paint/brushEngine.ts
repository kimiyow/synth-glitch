import {
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkRuntimeEffect,
  type SkSurface,
} from "@shopify/react-native-skia";

import { STAMP_SKSL } from "../engine/stamps/stamps";
import type { Stamp, StampEffect, Stroke } from "../state/types";

/** Resolución del buffer de pintura: lado largo de preview (3.4). */
export const PAINT_LONG_SIDE = 2048;

const STAMP_RUNTIME: Record<StampEffect, SkRuntimeEffect | null> = {
  datamosh: Skia.RuntimeEffect.Make(STAMP_SKSL.datamosh),
  chromatic: Skia.RuntimeEffect.Make(STAMP_SKSL.chromatic),
  pixel: Skia.RuntimeEffect.Make(STAMP_SKSL.pixel),
  smear: Skia.RuntimeEffect.Make(STAMP_SKSL.smear),
};

export function paintBufferSize(mediaW: number, mediaH: number, longSide = PAINT_LONG_SIDE) {
  const k = Math.min(1, longSide / Math.max(mediaW, mediaH));
  return { width: Math.round(mediaW * k), height: Math.round(mediaH * k) };
}

/** Dibuja el original escalado al buffer (estado sin pintura). */
export function drawOriginal(surface: SkSurface, original: SkImage) {
  "worklet";
  const canvas = surface.getCanvas();
  canvas.drawImageRect(
    original,
    Skia.XYWHRect(0, 0, original.width(), original.height()),
    Skia.XYWHRect(0, 0, surface.width(), surface.height()),
    Skia.Paint(),
  );
}

/**
 * Un sello sobre el buffer (3.6). x, y, size normalizados al ancho de la imagen, así que el
 * resultado no depende de la resolución del buffer (ADR-14). El efecto lee una instantánea
 * previa de su zona (copia al escribir), de modo que los sellos se apilan.
 */
export function drawStamp(surface: SkSurface, original: SkImage, stamp: Stamp) {
  "worklet";
  const bw = surface.width();
  const bh = surface.height();
  const sizePx = stamp.size * bw;
  const x0 = stamp.x * bw - sizePx / 2;
  const y0 = stamp.y * bw - sizePx / 2;
  const square = Skia.XYWHRect(x0, y0, sizePx, sizePx);
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  if (stamp.erase) {
    // BORRAR: restaura el original dentro del cuadrado.
    const sx = original.width() / bw;
    const sy = original.height() / bh;
    canvas.drawImageRect(original, Skia.XYWHRect(x0 * sx, y0 * sy, sizePx * sx, sizePx * sy), square, paint);
    return;
  }
  const runtime = STAMP_RUNTIME[stamp.effect];
  if (!runtime) return;
  const pad = sizePx;
  const bx = Math.max(0, Math.floor(x0 - pad));
  const by = Math.max(0, Math.floor(y0 - pad));
  const wid = Math.min(bw, Math.ceil(x0 + sizePx + pad)) - bx;
  const hei = Math.min(bh, Math.ceil(y0 + sizePx + pad)) - by;
  if (wid <= 0 || hei <= 0) return;
  const snap = surface.makeImageSnapshot(Skia.XYWHRect(bx, by, wid, hei));
  const child = snap.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Nearest,
    MipmapMode.None,
    Skia.Matrix().translate(bx, by),
  );
  const p = stamp.params;
  paint.setShader(
    runtime.makeShaderWithChildren([x0, y0, x0 + sizePx, y0 + sizePx, stamp.seed, p[0] ?? 0, p[1] ?? 0], [child]),
  );
  canvas.drawRect(square, paint);
}

/** Reproduce trazos sobre el buffer (deshacer, abrir y exportar). */
export function replayStrokes(surface: SkSurface, original: SkImage, strokes: readonly Stroke[], from = 0) {
  "worklet";
  for (let i = from; i < strokes.length; i++) {
    for (const stamp of strokes[i].stamps) drawStamp(surface, original, stamp);
  }
  surface.flush();
}

/** Imagen con la pintura aplicada, para miniaturas y exportación (hilo de JS). */
export function renderPainted(original: SkImage, strokes: readonly Stroke[], longSide: number): SkImage {
  if (strokes.length === 0) return original;
  const size = paintBufferSize(original.width(), original.height(), longSide);
  const surface = Skia.Surface.MakeOffscreen(size.width, size.height);
  if (!surface) throw new Error("NO SE PUDO CREAR LA SUPERFICIE DE PINTURA");
  drawOriginal(surface, original);
  replayStrokes(surface, original, strokes);
  return surface.makeImageSnapshot().makeNonTextureImage() ?? original;
}
