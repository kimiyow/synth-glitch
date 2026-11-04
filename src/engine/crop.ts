import type { CropAspect } from "../state/types";

/** [x, y, ancho, alto] normalizados a la imagen original. */
export type CropRect = [number, number, number, number];

export const FULL_CROP: CropRect = [0, 0, 1, 1];

/** Relación ancho/alto de cada aspecto (vertical). `free` no recorta. */
export const ASPECT_RATIO: Record<Exclude<CropAspect, "free">, number> = {
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
};

/** Recorte centrado más grande con el aspecto pedido (CAM-04, no destructivo). */
export function cropRectFor(mediaWidth: number, mediaHeight: number, aspect: CropAspect): CropRect {
  if (aspect === "free") return FULL_CROP;
  const target = ASPECT_RATIO[aspect];
  const media = mediaWidth / mediaHeight;
  if (media > target) {
    const w = target / media;
    return [(1 - w) / 2, 0, w, 1];
  }
  const h = media / target;
  return [0, (1 - h) / 2, 1, h];
}

/** Tamaño en px de la región recortada de la imagen original. */
export function croppedSize(mediaWidth: number, mediaHeight: number, rect: CropRect) {
  return { width: mediaWidth * rect[2], height: mediaHeight * rect[3] };
}

/** Escala `size` para que su lado largo sea `longSide`, sin agrandar. */
export function fitLongSide(size: { width: number; height: number }, longSide: number) {
  const scale = Math.min(1, longSide / Math.max(size.width, size.height));
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}

/**
 * Para dibujar el recorte en una salida de `outW × outH`: la escena se evalúa a tamaño
 * completo virtual (`fullW × fullH`, mismas coordenadas para preview y exportación,
 * ADR-14) y se desplaza `(-tx, -ty)`.
 */
export function cropViewport(outW: number, outH: number, rect: CropRect) {
  const fullW = outW / rect[2];
  const fullH = outH / rect[3];
  return { fullW, fullH, tx: rect[0] * fullW, ty: rect[1] * fullH };
}
