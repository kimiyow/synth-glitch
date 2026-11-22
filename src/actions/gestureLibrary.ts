import type { GestureClip, GesturePreset, Route } from "../domain/types";
import { settingsStore } from "../state/appSettings";
import { MAX_GESTURE_PRESETS } from "../state/settings";
import { addModulation, setGestureClip } from "./sceneEdits";

// gestos más cortos se descartan (un toque no es un gesto)
export const MIN_GESTURE_MS = 300;

// la modulación GESTO de una capa; si no tiene, la crea. null si la capa ya tiene el máximo
export function ensureGestureRoute(routes: readonly Route[], layerId: string): string | null {
  const existing = routes.find((r) => r.target.layerId === layerId && r.source === "track");
  return existing ? existing.id : addModulation(routes, layerId, "x", "track");
}

// guarda un gesto en la biblioteca de la app. Devuelve su nombre, o null si la biblioteca está llena
export function saveGesturePreset(clip: Pick<GestureClip, "durationMs" | "samples">): string | null {
  const { gestures } = settingsStore.getState();
  if (gestures.length >= MAX_GESTURE_PRESETS) return null;
  const used = new Set(gestures.map((g) => g.name));
  let n = gestures.length + 1;
  while (used.has(`Gesto ${n}`)) n++;
  const preset: GesturePreset = {
    id: `g-${Date.now().toString(36)}`,
    name: `Gesto ${n}`,
    durationMs: clip.durationMs,
    samples: [...clip.samples],
  };
  settingsStore.getState().update({ gestures: [...gestures, preset] });
  return preset.name;
}

// largo máximo del nombre (el mismo que acepta la lectura de los ajustes)
export const MAX_GESTURE_NAME = 30;

// renombra un gesto de la biblioteca. Vacío o solo espacios: conserva el nombre. Devuelve el nombre
// que queda
export function renameGesturePreset(id: string, name: string): string | null {
  const { gestures } = settingsStore.getState();
  const current = gestures.find((g) => g.id === id);
  if (!current) return null;
  const clean = name.replace(/\s+/g, " ").trim().slice(0, MAX_GESTURE_NAME);
  if (!clean || clean === current.name) return current.name;
  settingsStore.getState().update({ gestures: gestures.map((g) => (g.id === id ? { ...g, name: clean } : g)) });
  return clean;
}

export function removeGesturePreset(id: string) {
  const { gestures } = settingsStore.getState();
  settingsStore.getState().update({ gestures: gestures.filter((g) => g.id !== id) });
}

// aplica un gesto guardado a una capa (crea su modulación GESTO si hace falta). false si no cabe
export function applyGesturePreset(routes: readonly Route[], layerId: string, preset: GesturePreset): boolean {
  const routeId = ensureGestureRoute(routes, layerId);
  if (!routeId) return false;
  setGestureClip(routeId, preset, "aplicar gesto");
  return true;
}
