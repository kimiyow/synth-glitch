import { createStore } from "zustand/vanilla";

import type { CropAspect } from "../domain/types";

export type CameraAspect = Exclude<CropAspect, "free">;
export const CAMERA_ASPECTS: readonly CameraAspect[] = ["9:16", "1:1", "4:5"];

export type AppSettings = {
  // última relación elegida en la cámara (se recuerda)
  cameraAspect: CameraAspect;
  // el aviso MANTÉN PARA GRABAR se muestra hasta grabar el primer clip
  holdHintSeen: boolean;
  // el onboarding se muestra en el primer arranque y se puede reabrir
  onboardingSeen: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = { cameraAspect: "9:16", holdHintSeen: false, onboardingSeen: false };

// lee los ajustes guardados; cualquier campo inválido o ausente toma su valor por defecto
export function parseSettings(raw: unknown): AppSettings {
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    cameraAspect: CAMERA_ASPECTS.includes(o.cameraAspect as CameraAspect)
      ? (o.cameraAspect as CameraAspect)
      : DEFAULT_SETTINGS.cameraAspect,
    holdHintSeen: typeof o.holdHintSeen === "boolean" ? o.holdHintSeen : DEFAULT_SETTINGS.holdHintSeen,
    onboardingSeen: typeof o.onboardingSeen === "boolean" ? o.onboardingSeen : DEFAULT_SETTINGS.onboardingSeen,
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
      const { cameraAspect, holdHintSeen, onboardingSeen } = get();
      try {
        io.save({ cameraAspect, holdHintSeen, onboardingSeen });
      } catch {
        // no guardar un ajuste no debe romper la app; se reintenta en el próximo cambio
      }
    },
  }));
}
