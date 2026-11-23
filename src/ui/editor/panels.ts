// botones de la barra inferior. Modulación es un atajo a las modulaciones de la capa seleccionada
// Gesto no está en la barra: se abre desde su tarjeta en Modulación
export type ToolButtonId = "brush" | "effects" | "layers" | "mod" | "presets";
export type PanelId = "brush" | "effects" | "layers" | "mod" | "presets" | "gesture" | "export" | "stage";

// gestor de superposiciones como pila pura:
// - tocar el botón de la superposición abierta la cierra; otro botón la reemplaza;
// - se pueden apilar (p. ej. renombrar sobre Exportar) y solo reacciona la superior
export type OverlayStack = readonly string[];

export function toggleOverlay(stack: OverlayStack, id: string): OverlayStack {
  return stack[0] === id ? [] : [id];
}

export function pushOverlay(stack: OverlayStack, id: string): OverlayStack {
  return [...stack, id];
}

// toque fuera, deslizar hacia abajo o botón de volver: cierra solo la superior
export function popOverlay(stack: OverlayStack): OverlayStack {
  return stack.slice(0, -1);
}
