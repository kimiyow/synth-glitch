import { canAddLayer } from "../engine/layerCost";
import { EFFECT_BY_ID, GENERATOR_BY_ID } from "../engine/registry";
import { calibrateFloor } from "../modulation/micEnvelope";
import { stampSeed } from "../paint/strokeInterpolate";
import { sceneStore } from "../state/activeScene";
import type {
  BlendMode,
  EffectId,
  GeneratorId,
  Layer,
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
  });
}

export function rerollSeed(layerId: string) {
  commit("semilla", (scene) => {
    const layer = scene.layers.find((l) => l.id === layerId);
    if (layer?.kind === "generator") layer.seed = Math.floor(Math.random() * 1000);
  });
}

// una ruta por eje; DEDO quita la ruta
export function setRouteSource(layerId: string, axis: Axis, source: SourceId) {
  commit("ruta de modulación", (scene) => {
    const prev = scene.routes.find((r) => r.target.layerId === layerId && r.target.param === axis);
    scene.routes = scene.routes.filter((r) => r !== prev);
    if (source === "touch") return;
    scene.routes.push({
      id: `${layerId}-${axis}`,
      source,
      sourceIndex: 0,
      target: { layerId, param: axis },
      amount: prev?.amount ?? 0.5,
      curve: "lin",
      // el secuenciador fija el valor de cada paso; el resto se suma al gesto
      mode: source === "seq" ? "replace" : "add",
    });
  });
}

export function setRouteAmount(layerId: string, axis: Axis, amount: number) {
  commit("cantidad de modulación", (scene) => {
    const r = scene.routes.find((x) => x.target.layerId === layerId && x.target.param === axis);
    if (r) r.amount = amount;
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
