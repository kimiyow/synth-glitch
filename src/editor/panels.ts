/** Botones de la barra inferior (4.2). Giro es un interruptor sin panel. */
export type ToolButtonId = "brush" | "effects" | "mod" | "gyro" | "presets" | "gesture";
export type PanelId = "brush" | "effects" | "mod" | "presets" | "gesture" | "export";

/**
 * Gestor de superposiciones (ADR-07, 3.9) como pila pura:
 * - tocar el botón de la superposición abierta la cierra; otro botón la reemplaza;
 * - se pueden apilar (p. ej. renombrar sobre Exportar) y solo reacciona la superior.
 */
export type OverlayStack = readonly string[];

export function toggleOverlay(stack: OverlayStack, id: string): OverlayStack {
  return stack[0] === id ? [] : [id];
}

export function pushOverlay(stack: OverlayStack, id: string): OverlayStack {
  return [...stack, id];
}

/** Toque fuera, deslizar hacia abajo o botón de volver: cierra solo la superior. */
export function popOverlay(stack: OverlayStack): OverlayStack {
  return stack.slice(0, -1);
}
