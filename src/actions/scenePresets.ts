import type { Layer, Route, ScenePreset, SourceConfig } from "../domain/types";
import { settingsStore } from "../state/appSettings";
import { MAX_SCENE_PRESETS } from "../state/settings";
import { applySceneVariation } from "./sceneEdits";

// copia con ids nuevos: el preset queda independiente de la escena de la que salió, y aplicarlo
// dos veces no repite ids de capas ni de rutas
function withFreshIds(layers: readonly Layer[], routes: readonly Route[]): { layers: Layer[]; routes: Route[] } {
  const tag = Date.now().toString(36);
  const map = new Map<string, string>();
  const nextLayers = layers.map((l, i) => {
    const id = `${l.kind === "effect" ? l.effect : l.generator}-${tag}${i}`;
    map.set(l.id, id);
    return { ...JSON.parse(JSON.stringify(l)), id } as Layer;
  });
  const nextRoutes = routes
    .filter((r) => map.has(r.target.layerId))
    .map((r, i) => {
      const copy = JSON.parse(JSON.stringify(r)) as Route;
      return { ...copy, id: `mod-${tag}${i}`, target: { ...copy.target, layerId: map.get(r.target.layerId) ?? copy.target.layerId } };
    });
  return { layers: nextLayers, routes: nextRoutes };
}

// firma de una escena sin ids: capas en orden y modulaciones apuntando al índice de su capa. Dos
// escenas con la misma firma se ven y se mueven igual (aplicar un preset le da ids nuevos)
export function sceneSignature(layers: readonly Layer[], routes: readonly Route[]): string {
  const index = new Map(layers.map((l, i) => [l.id, i]));
  const ls = layers.map(({ id: _id, ...rest }) => rest);
  const rs = routes
    .filter((r) => index.has(r.target.layerId))
    .map(({ id: _id, target, ...rest }) => ({ ...rest, target: { layer: index.get(target.layerId), param: target.param } }));
  return JSON.stringify({ ls, rs });
}

// la escena guardada (de fábrica o propia) igual a la actual, si hay
export function findSameScene(presets: readonly ScenePreset[], layers: readonly Layer[], routes: readonly Route[]): ScenePreset | null {
  if (layers.length === 0) return null;
  const sig = sceneSignature(layers, routes);
  return presets.find((p) => sceneSignature(p.layers, p.routes) === sig) ?? null;
}

export type SaveSceneResult = { kind: "saved"; name: string } | { kind: "exists"; name: string } | { kind: "full" };

// guarda la escena actual (capas + modulaciones), salvo que ya esté guardada o la biblioteca esté
// llena
export function saveScenePreset(layers: readonly Layer[], routes: readonly Route[], sources: SourceConfig, factory: readonly ScenePreset[] = []): SaveSceneResult {
  const { scenes } = settingsStore.getState();
  const same = findSameScene([...factory, ...scenes], layers, routes);
  if (same) return { kind: "exists", name: same.name };
  if (scenes.length >= MAX_SCENE_PRESETS) return { kind: "full" };
  const used = new Set(scenes.map((s) => s.name));
  let n = scenes.length + 1;
  while (used.has(`Escena ${n}`)) n++;
  const copy = withFreshIds(layers, routes);
  const preset: ScenePreset = { id: `s-${Date.now().toString(36)}`, name: `Escena ${n}`, builtIn: false, ...copy, sources };
  settingsStore.getState().update({ scenes: [...scenes, preset] });
  return { kind: "saved", name: preset.name };
}

export const MAX_SCENE_NAME = 30;

// renombra una escena propia. Vacío o solo espacios: conserva el nombre
export function renameScenePreset(id: string, name: string) {
  const { scenes } = settingsStore.getState();
  const clean = name.replace(/\s+/g, " ").trim().slice(0, MAX_SCENE_NAME);
  if (!clean) return;
  settingsStore.getState().update({ scenes: scenes.map((s) => (s.id === id ? { ...s, name: clean } : s)) });
}

// reemplaza el contenido de una escena propia por la escena actual (conserva nombre y lugar)
export function updateScenePreset(id: string, layers: readonly Layer[], routes: readonly Route[], sources: SourceConfig) {
  const { scenes } = settingsStore.getState();
  const copy = withFreshIds(layers, routes);
  settingsStore.getState().update({ scenes: scenes.map((s) => (s.id === id ? { ...s, ...copy, sources } : s)) });
}

export function removeScenePreset(id: string) {
  const { scenes } = settingsStore.getState();
  settingsStore.getState().update({ scenes: scenes.filter((s) => s.id !== id) });
}

// reemplaza las capas y modulaciones de la escena por las del preset (deshacible). Devuelve el id
// de la última capa, para seleccionarla
export function applyScenePreset(preset: ScenePreset): string | null {
  const next = withFreshIds(preset.layers, preset.routes);
  applySceneVariation(next, `preset · ${preset.name}`);
  return next.layers.at(-1)?.id ?? null;
}
