import type { StampEffect } from "../state/types";

/** Chip del panel Pincel: un efecto de sello o BORRAR (S9). */
export type BrushTool = StampEffect | "erase";

/** 3.6: límites del pincel. */
export const MAX_STROKES = 400;
export const MIN_SIZE = 0.01; // 1 % del ancho
export const MAX_SIZE = 0.4; // 40 % del ancho

/** Parámetros por defecto de cada efecto de sello (tabla 3.6). */
export const STAMP_DEFAULTS: Record<StampEffect, number[]> = {
  datamosh: [6, 0.35], // franjas, amplitud
  chromatic: [0.12], // amplitud
  pixel: [6], // celdas
  smear: [1.0], // longitud
};

/** Punto de colocación pendiente: el último sello y lo recorrido desde él. */
export type StrokeCursor = { x: number; y: number } | null;

/**
 * Coloca sellos a lo largo del recorrido (3.6): el primero al apoyar el dedo y después
 * uno cada `spacing`, interpolando entre muestras para no dejar huecos a velocidad alta.
 * Coordenadas en cualquier unidad, siempre que `spacing` use la misma.
 */
export function advanceStroke(
  cursor: StrokeCursor,
  x: number,
  y: number,
  spacing: number,
): { stamps: { x: number; y: number }[]; cursor: StrokeCursor } {
  "worklet";
  if (cursor === null) return { stamps: [{ x, y }], cursor: { x, y } };
  const stamps: { x: number; y: number }[] = [];
  let cx = cursor.x;
  let cy = cursor.y;
  const step = Math.max(spacing, 1e-6);
  let dx = x - cx;
  let dy = y - cy;
  let dist = Math.sqrt(dx * dx + dy * dy);
  while (dist >= step) {
    cx += (dx / dist) * step;
    cy += (dy / dist) * step;
    stamps.push({ x: cx, y: cy });
    dx = x - cx;
    dy = y - cy;
    dist = Math.sqrt(dx * dx + dy * dy);
  }
  return { stamps, cursor: { x: cx, y: cy } };
}

/** Tamaño constante en pantalla (BRU-05): px de pantalla → fracción del ancho de la imagen. */
export function screenToImageFraction(screenPx: number, zoom: number, displayedImageWidth: number): number {
  "worklet";
  return screenPx / (zoom * displayedImageWidth);
}

/**
 * Semilla determinista de un sello (BRU-07): hash(semillaDeEscena, índiceDeTrazo, índiceDeSello).
 * Entero en [0, 10007) para que el shader no pierda precisión en float.
 */
export function stampSeed(sceneSeed: number, strokeIndex: number, stampIndex: number): number {
  "worklet";
  let h = (sceneSeed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (strokeIndex + 0x85ebca6b), 0xcc9e2d51);
  h = Math.imul(h ^ (h >>> 15), 0x1b873593);
  h = Math.imul(h ^ (stampIndex + 0xc2b2ae35), 0x27d4eb2f);
  h ^= h >>> 13;
  return ((h >>> 0) % 10007);
}
