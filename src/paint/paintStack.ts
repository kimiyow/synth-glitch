import { MAX_LAYERS } from "../engine/layerCost";
import type { Layer, PaintLayer } from "../domain/types";

// la pintura es una fila más de la pila de capas (PINTURA). Sus trazos viven en scene.paint y su
// lugar en la pila es paint.index: cuántas capas quedan debajo (0 = justo sobre la imagen)

// id de la fila de la pintura en la lista de Capas (no choca con los ids de capa: llevan sufijo)
export const PAINT_ROW_ID = "pintura";

// la capa de pintura existe mientras tenga trazos
export function hasPaint(paint: PaintLayer): boolean {
  return paint.strokes.length > 0;
}

// lugar de una pintura nueva: encima del último generador en replace (que taparía la imagen y con
// ella la pintura); sin él, sobre la imagen, debajo de los efectos
export function defaultPaintIndex(layers: readonly Layer[]): number {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (l.kind === "generator" && l.blend === "replace") return i + 1;
  }
  return 0;
}

export function clampPaintIndex(index: number, layers: readonly Layer[]): number {
  return Math.min(layers.length, Math.max(0, Math.round(index)));
}

// cuántos nodos de la cadena de render (capas visibles, hasta MAX_LAYERS) quedan debajo de la pintura
export function paintChainIndex(layers: readonly Layer[], index: number): number {
  let n = 0;
  const end = clampPaintIndex(index, layers);
  for (let i = 0; i < end && n < MAX_LAYERS; i++) if (layers[i].visible) n++;
  return n;
}

// ids de la pila en orden de aplicación, con la fila de pintura en su lugar (si tiene trazos)
export function stackIds(layers: readonly Layer[], paint: PaintLayer): string[] {
  const ids = layers.map((l) => l.id);
  if (hasPaint(paint)) ids.splice(clampPaintIndex(paint.index, layers), 0, PAINT_ROW_ID);
  return ids;
}

// mueve una fila (capa o pintura) a la posición `to` de la pila; devuelve el nuevo orden de capas y
// el nuevo lugar de la pintura
export function moveInStack(layers: readonly Layer[], paint: PaintLayer, id: string, to: number): { layers: Layer[]; paintIndex: number } {
  const ids = stackIds(layers, paint);
  const from = ids.indexOf(id);
  if (from < 0) return { layers: [...layers], paintIndex: paint.index };
  const dest = Math.min(ids.length - 1, Math.max(0, to));
  ids.splice(from, 1);
  ids.splice(dest, 0, id);
  const byId = new Map(layers.map((l) => [l.id, l]));
  const paintAt = ids.indexOf(PAINT_ROW_ID);
  return {
    layers: ids.filter((x) => x !== PAINT_ROW_ID).map((x) => byId.get(x)!),
    paintIndex: paintAt < 0 ? paint.index : paintAt,
  };
}
