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

// guarda la escena actual (capas + modulaciones). Devuelve su nombre, o null si la biblioteca está
// llena
export function saveScenePreset(layers: readonly Layer[], routes: readonly Route[], sources: SourceConfig): string | null {
  const { scenes } = settingsStore.getState();
  if (scenes.length >= MAX_SCENE_PRESETS) return null;
  const used = new Set(scenes.map((s) => s.name));
  let n = scenes.length + 1;
  while (used.has(`Escena ${n}`)) n++;
  const copy = withFreshIds(layers, routes);
  const preset: ScenePreset = { id: `s-${Date.now().toString(36)}`, name: `Escena ${n}`, builtIn: false, ...copy, sources };
  settingsStore.getState().update({ scenes: [...scenes, preset] });
  return preset.name;
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
