/**
 * Vista del lienzo (3.9): p_pantalla = t + s · p_base, donde p_base son coordenadas de la
 * imagen ajustada (contain) al visor a escala 1. Funciones worklet, sin estado.
 */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;

export type Box = { x: number; y: number; width: number; height: number };

/** Imagen `contain` dentro del visor, centrada. */
export function fitContain(viewW: number, viewH: number, imgW: number, imgH: number): Box {
  "worklet";
  const scale = Math.min(viewW / imgW, viewH / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  return { x: (viewW - width) / 2, y: (viewH - height) / 2, width, height };
}

/** Traslación en un eje: sin huecos si el contenido es mayor que el visor; centrado si es menor. */
export function clampAxis(t: number, s: number, offset: number, size: number, view: number): number {
  "worklet";
  const scaled = size * s;
  if (scaled <= view) return (view - scaled) / 2 - offset * s;
  return Math.min(-offset * s, Math.max(view - (offset + size) * s, t));
}

export function clampZoom(s: number): number {
  "worklet";
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));
}

/** Conversión pantalla → imagen normalizada (0-1 en cada eje), para las herramientas (M5, M6). */
export function screenToImage(px: number, py: number, s: number, tx: number, ty: number, base: Box) {
  "worklet";
  return { x: ((px - tx) / s - base.x) / base.width, y: ((py - ty) / s - base.y) / base.height };
}
