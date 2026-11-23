import { canAddLayer } from "../engine/layerCost";
import { EFFECT_BY_ID, GENERATOR_BY_ID } from "../engine/registry";
import { calibrateFloor } from "../modulation/micEnvelope";
import { defaultRouteSetting } from "../modulation/sources";
import { clampPaintIndex, defaultPaintIndex, hasPaint, moveInStack } from "../paint/paintStack";
import { stampSeed } from "../paint/strokeInterpolate";
import { sceneStore } from "../state/activeScene";
import type {
  BlendMode,
  EffectId,
  GeneratorId,
  GestureClip,
  Layer,
  Route,
  RouteSettings,
  SourceConfig,
  SourceId,
  Stamp,
} from "../domain/types";

// cambios del editor sobre la escena activa. cada uno es un cambio deshacible, salvo los que usan adjust

type Axis = "x" | "y";
type Params = { x: number; y: number };
export type LayerTile = { kind: "effect"; effect: EffectId } | { kind: "generator"; generator: GeneratorId };

const commit: ReturnType<typeof sceneStore.getState>["commit"] = (label, recipe) => sceneStore.getState().commit(label, recipe);

// enciende la capa de una ficha. devuelve su id, o null si ya no caben más capas
export function addTileLayer(layers: readonly Layer[], tile: LayerTile): string | null {
  if (!canAddLayer(layers)) return null;
  const name = tile.kind === "effect" ? tile.effect : tile.generator;
  const id = `${name}-${Date.now().toString(36)}`;
  // sobre una foto, screen deja ver la imagen; replace la taparía por completo
  const next: Layer =
    tile.kind === "effect"
      ? { kind: "effect", id, effect: tile.effect, params: { ...EFFECT_BY_ID[tile.effect].defaults }, visible: true }
      : {
          kind: "generator",
          id,
          generator: tile.generator,
          params: { ...GENERATOR_BY_ID[tile.generator].defaults },
          visible: true,
          blend: "screen",
        };
  commit(`encender ${name}`, (scene) => {
    scene.layers.push(next);
  });
  return id;
}

// la capa de una ficha, si ya está encendida
export function findTileLayer(layers: readonly Layer[], tile: LayerTile): Layer | undefined {
  return layers.find((l) =>
    tile.kind === "effect" ? l.kind === "effect" && l.effect === tile.effect : l.kind === "generator" && l.generator === tile.generator,
  );
}

// quita la capa y sus rutas
export function removeLayer(layerId: string) {
  commit("quitar capa", (scene) => {
    // la pintura conserva su lugar respecto de las capas que siguen debajo
    const at = scene.layers.findIndex((l) => l.id === layerId);
    if (at >= 0 && at < scene.paint.index) scene.paint.index -= 1;
    scene.layers = scene.layers.filter((l) => l.id !== layerId);
    scene.routes = scene.routes.filter((r) => r.target.layerId !== layerId);
  });
}

export function resetLayer(layerId: string) {
  commit("reiniciar efecto", (scene) => {
    const layer = scene.layers.find((l) => l.id === layerId);
    if (layer?.kind === "effect") layer.params = { ...EFFECT_BY_ID[layer.effect].defaults };
    if (layer?.kind === "generator") layer.params = { ...GENERATOR_BY_ID[layer.generator].defaults };
  });
}

// con label entra al historial; sin label es solo vista previa
export function setLayerParams(layerId: string, params: Params, label: string | null) {
  const recipe = (scene: { layers: Layer[] }) => {
    const layer = scene.layers.find((l) => l.id === layerId);
    if (layer) layer.params = params;
  };
  if (label) commit(label, recipe);
  else sceneStore.getState().adjust(recipe);
}

// valor del gesto X/Y al soltar, redondeado a 3 decimales
export function commitXY(layerId: string, x: number, y: number) {
  commit("ajustar efecto", (scene) => {
    const layer = scene.layers.find((l) => l.id === layerId);
    if (layer) layer.params = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  });
}

export function setBlend(layerId: string, blend: BlendMode) {
  commit("modo de mezcla", (scene) => {
    const layer = scene.layers.find((l) => l.id === layerId);
    if (layer?.kind === "generator") layer.blend = blend;
    // en un efecto, normal es no tener modo (así coincide con los guardados antes de FX-06)
    if (layer?.kind === "effect") {
      if (blend === "replace") delete layer.blend;
      else layer.blend = blend;
    }
  });
}

// opacidad de una capa (0..1). Con label entra al historial; sin label es solo vista previa. Al
// 100 % no se guarda
export function setLayerOpacity(layerId: string, opacity: number, label: string | null) {
  const recipe = (scene: { layers: Layer[] }) => {
    const layer = scene.layers.find((l) => l.id === layerId);
    if (!layer) return;
    const v = Math.round(Math.min(1, Math.max(0, opacity)) * 100) / 100;
    if (v >= 1) delete layer.opacity;
    else layer.opacity = v;
  };
  if (label) commit(label, recipe);
  else sceneStore.getState().adjust(recipe);
}

export function rerollSeed(layerId: string) {
  commit("semilla", (scene) => {
    const layer = scene.layers.find((l) => l.id === layerId);
    if (layer?.kind === "generator") layer.seed = Math.floor(Math.random() * 1000);
  });
}

// modulaciones: cada capa puede tener varias, cada una con su fuente y sus propios ajustes
export const MAX_MODS_PER_LAYER = 4;

// el secuenciador y el gesto fijan el valor; el resto se suma al gesto X/Y
const routeMode = (source: SourceId): Route["mode"] => (source === "seq" || source === "track" ? "replace" : "add");

// el gesto fija la posición (reemplaza el valor del parámetro) con intensidad completa; el resto se
// suma al gesto X/Y con media intensidad
const defaultAmount = (source: SourceId) => (source === "track" ? 1 : 0.5);

// añade una modulación sobre el eje dado (LFO si no se indica). Devuelve su id, o null si la capa
// ya tiene el máximo
export function addModulation(routes: readonly Route[], layerId: string, param: Axis, source: SourceId = "lfo"): string | null {
  if (routes.filter((r) => r.target.layerId === layerId).length >= MAX_MODS_PER_LAYER) return null;
  const id = `mod-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
  commit("añadir modulación", (scene) => {
    scene.routes.push({
      id,
      source,
      sourceIndex: 0,
      target: { layerId, param },
      amount: defaultAmount(source),
      curve: "lin",
      mode: routeMode(source),
      settings: defaultRouteSetting(source, scene.sources),
    });
  });
  return id;
}

// gesto recién grabado (o aplicado desde la biblioteca) de una modulación GESTO
// un gesto nuevo (grabado o de la biblioteca) entra sin transformaciones: suena como se grabó
export function setGestureClip(routeId: string, clip: Pick<GestureClip, "durationMs" | "samples">, label = "grabar gesto") {
  commit(label, (scene) => {
    const r = scene.routes.find((x) => x.id === routeId);
    if (!r) return;
    const loop = r.settings?.gesture?.loop ?? "smooth";
    r.settings = { ...r.settings, gesture: { durationMs: clip.durationMs, samples: [...clip.samples], loop } };
  });
}

export type GestureTransform = Partial<Pick<GestureClip, "speed" | "direction" | "mirrorX" | "mirrorY" | "loop">>;

// velocidad, dirección o espejo del gesto de una modulación (un cambio deshacible)
export function setGestureTransform(routeId: string, patch: GestureTransform) {
  commit("transformar gesto", (scene) => {
    const g = scene.routes.find((x) => x.id === routeId)?.settings?.gesture;
    if (!g) return;
    Object.assign(g, patch);
  });
}

export function removeModulation(routeId: string) {
  commit("quitar modulación", (scene) => {
    scene.routes = scene.routes.filter((r) => r.id !== routeId);
  });
}

// cambia la fuente; conserva los ajustes que ya tenía para cada tipo
export function setModulationSource(routeId: string, source: SourceId) {
  commit("fuente de modulación", (scene) => {
    const r = scene.routes.find((x) => x.id === routeId);
    if (!r || r.source === source) return;
    r.source = source;
    r.mode = routeMode(source);
    if (source === "track") r.amount = 1;
    const key = source as keyof RouteSettings;
    if (!r.settings?.[key]) r.settings = { ...r.settings, ...defaultRouteSetting(source, scene.sources) };
  });
}

// cambio deshacible de una modulación (eje, cantidad, curva, modo o ajustes de su fuente)
export function updateModulation(routeId: string, label: string, recipe: (route: Route) => void) {
  commit(label, (scene) => {
    const r = scene.routes.find((x) => x.id === routeId);
    if (r) recipe(r);
  });
}

// ajusta los valores propios de la fuente de una modulación (los crea si la ruta aún no los tenía)
export function patchModulationSettings<K extends keyof RouteSettings>(
  routeId: string,
  key: K,
  label: string,
  patch: Partial<NonNullable<RouteSettings[K]>>,
) {
  commit(label, (scene) => {
    const r = scene.routes.find((x) => x.id === routeId);
    if (!r) return;
    if (!r.settings?.[key]) r.settings = { ...r.settings, ...defaultRouteSetting(key as SourceId, scene.sources) };
    const cur = r.settings[key];
    if (cur) Object.assign(cur, patch);
  });
}

// reemplaza capas y rutas por una variación (mutar o aleatorizar); la pintura, el medio y el
// recorte no cambian. Un cambio deshacible
export function applySceneVariation(next: { layers: Layer[]; routes: Route[] }, label: string) {
  commit(label, (scene) => {
    scene.layers = next.layers;
    scene.routes = next.routes;
    scene.paint.index = clampPaintIndex(scene.paint.index, scene.layers);
  });
}

// mueve una fila de Capas (una capa o la pintura, PAINT_ROW_ID) a otra posición de la pila. La
// posición cuenta la fila de pintura si existe; la primera se aplica antes
export function moveLayer(rowId: string, toIndex: number) {
  commit("ordenar capas", (scene) => {
    const next = moveInStack(scene.layers, scene.paint, rowId, toIndex);
    scene.layers = next.layers;
    scene.paint.index = next.paintIndex;
  });
}

export function togglePaintVisible() {
  commit("mostrar u ocultar pintura", (scene) => {
    scene.paint.visible = !scene.paint.visible;
  });
}

// quita la capa PINTURA (todos sus trazos)
export function clearPaint() {
  commit("borrar pintura", (scene) => {
    scene.paint.strokes = [];
    scene.paint.visible = true;
  });
}

export function toggleLayerVisible(layerId: string) {
  commit("mostrar u ocultar capa", (scene) => {
    const layer = scene.layers.find((l) => l.id === layerId);
    if (layer) layer.visible = !layer.visible;
  });
}

export function setSources(next: SourceConfig) {
  commit("ajustar fuente", (scene) => {
    scene.sources = next;
  });
}

// el tempo no entra al historial
export function setTempo(bpm: number) {
  sceneStore.getState().adjust((scene) => {
    scene.sources.tempo.bpm = bpm;
  });
}

export function commitStroke(stamps: Stamp[]) {
  commit("trazo", (scene) => {
    // el primer trazo crea la capa PINTURA; pintar sobre ella oculta la vuelve a mostrar
    if (!hasPaint(scene.paint)) scene.paint.index = defaultPaintIndex(scene.layers);
    scene.paint.visible = true;
    const index = scene.paint.strokes.length;
    scene.paint.strokes.push({
      id: `s${Date.now().toString(36)}-${index}`,
      strokeSeed: stampSeed(scene.seed, index, 0),
      stamps,
    });
  });
}

// fija el piso del micrófono con lecturas tomadas en silencio
export function calibrateMic(samples: number[]) {
  commit("calibrar micrófono", (scene) => {
    scene.sources.mic = calibrateFloor(samples, scene.sources.mic);
  });
}
