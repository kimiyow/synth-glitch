import { createStore } from "zustand/vanilla";

import type { CropAspect, GesturePreset, ScenePreset } from "../domain/types";
import { parseSources, withRouteSettings } from "../modulation/sources";
import { parseLayer, parseRoute } from "../project/schema";

export type CameraAspect = Exclude<CropAspect, "free">;
export const CAMERA_ASPECTS: readonly CameraAspect[] = ["9:16", "1:1", "4:5"];

export type AppSettings = {
  // última relación elegida en la cámara (se recuerda)
  cameraAspect: CameraAspect;
  // el aviso MANTÉN PARA GRABAR se muestra hasta grabar el primer clip
  holdHintSeen: boolean;
  // el onboarding se muestra en el primer arranque y se puede reabrir
  onboardingSeen: boolean;
  // biblioteca de presets gestuales (compartida entre proyectos)
  gestures: GesturePreset[];
  // presets de escena del usuario (capas + modulaciones, sin foto ni pintura)
  scenes: ScenePreset[];
  // transición al disparar una escena, en tiempos del reloj (0 = corte)
  sceneFade: SceneFadeBeats;
};

export type SceneFadeBeats = 0 | 1 | 2 | 4;
export const SCENE_FADE_BEATS: readonly SceneFadeBeats[] = [0, 1, 2, 4];

export const DEFAULT_SETTINGS: AppSettings = { cameraAspect: "9:16", holdHintSeen: false, onboardingSeen: false, gestures: [], scenes: [], sceneFade: 2 };

// presets de escena del usuario que se conservan
export const MAX_SCENE_PRESETS = 30;

// presets de escena guardados; uno dañado se descarta sin afectar a los demás
function parseScenes(v: unknown): ScenePreset[] {
  if (!Array.isArray(v)) return [];
  const out: ScenePreset[] = [];
  for (const raw of v) {
    try {
      if (typeof raw !== "object" || raw === null) continue;
      const o = raw as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.name !== "string" || !Array.isArray(o.layers) || !Array.isArray(o.routes)) continue;
      const sources = parseSources(o.sources);
      const layers = o.layers.map((l, i) => parseLayer(l, `scenes.layers[${i}]`));
      const ids = new Set(layers.map((l) => l.id));
      const routes = o.routes
        .map((r, i) => withRouteSettings(parseRoute(r, `scenes.routes[${i}]`), sources))
        .filter((r) => ids.has(r.target.layerId));
      out.push({ id: o.id, name: o.name.slice(0, 30), builtIn: false, layers, routes, sources });
    } catch {
      // preset inválido: se omite
    }
  }
  return out.slice(0, MAX_SCENE_PRESETS);
}

// gestos que se conservan en la biblioteca (cada uno ocupa hasta ~600 números)
export const MAX_GESTURE_PRESETS = 12;

function parseGestures(v: unknown): GesturePreset[] {
  if (!Array.isArray(v)) return [];
  const out: GesturePreset[] = [];
  for (const g of v) {
    if (typeof g !== "object" || g === null) continue;
    const o = g as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.durationMs !== "number" || !Array.isArray(o.samples)) continue;
    const samples = o.samples.filter((s): s is number => typeof s === "number" && Number.isFinite(s)).map((s) => Math.min(1, Math.max(0, s)));
    if (samples.length < 4) continue;
    out.push({ id: o.id, name: o.name.slice(0, 30), durationMs: Math.min(10000, Math.max(0, o.durationMs)), samples: samples.slice(0, 600 - (samples.length % 2)) });
  }
  return out.slice(0, MAX_GESTURE_PRESETS);
}

// lee los ajustes guardados; cualquier campo inválido o ausente toma su valor por defecto
export function parseSettings(raw: unknown): AppSettings {
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    cameraAspect: CAMERA_ASPECTS.includes(o.cameraAspect as CameraAspect)
      ? (o.cameraAspect as CameraAspect)
      : DEFAULT_SETTINGS.cameraAspect,
    holdHintSeen: typeof o.holdHintSeen === "boolean" ? o.holdHintSeen : DEFAULT_SETTINGS.holdHintSeen,
    onboardingSeen: typeof o.onboardingSeen === "boolean" ? o.onboardingSeen : DEFAULT_SETTINGS.onboardingSeen,
    gestures: parseGestures(o.gestures),
    scenes: parseScenes(o.scenes),
    sceneFade: SCENE_FADE_BEATS.includes(o.sceneFade as SceneFadeBeats) ? (o.sceneFade as SceneFadeBeats) : DEFAULT_SETTINGS.sceneFade,
  };
}

export type SettingsState = AppSettings & { update(patch: Partial<AppSettings>): void };

export function createSettingsStore(io: { load: () => unknown; save: (settings: AppSettings) => void }) {
  let initial = DEFAULT_SETTINGS;
  try {
    initial = parseSettings(io.load());
  } catch {
    // archivo ausente o dañado: valores por defecto
  }
  return createStore<SettingsState>()((set, get) => ({
    ...initial,
    update(patch) {
      set(patch);
      const { cameraAspect, holdHintSeen, onboardingSeen, gestures, scenes, sceneFade } = get();
      try {
        io.save({ cameraAspect, holdHintSeen, onboardingSeen, gestures, scenes, sceneFade });
      } catch {
        // no guardar un ajuste no debe romper la app; se reintenta en el próximo cambio
      }
    },
  }));
}
