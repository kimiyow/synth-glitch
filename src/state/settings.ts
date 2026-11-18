import { createStore } from "zustand/vanilla";

import type { CropAspect, GesturePreset } from "../domain/types";

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
};

export const DEFAULT_SETTINGS: AppSettings = { cameraAspect: "9:16", holdHintSeen: false, onboardingSeen: false, gestures: [] };

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
      const { cameraAspect, holdHintSeen, onboardingSeen, gestures } = get();
      try {
        io.save({ cameraAspect, holdHintSeen, onboardingSeen, gestures });
      } catch {
        // no guardar un ajuste no debe romper la app; se reintenta en el próximo cambio
      }
    },
  }));
}
