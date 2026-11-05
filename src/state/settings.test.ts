import { describe, expect, it } from "@jest/globals";

import { createSettingsStore, DEFAULT_SETTINGS, parseSettings, type AppSettings } from "./settings";

describe("parseSettings", () => {
  it("usa los valores por defecto ante datos inválidos", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ cameraAspect: "16:9", holdHintSeen: "sí" })).toEqual(DEFAULT_SETTINGS);
  });

  it("conserva valores válidos e ignora campos extra", () => {
    expect(parseSettings({ cameraAspect: "1:1", holdHintSeen: true, otro: 1 })).toEqual({
      cameraAspect: "1:1",
      holdHintSeen: true,
      onboardingSeen: false,
    });
  });
});

describe("createSettingsStore", () => {
  it("carga, actualiza y guarda", () => {
    const saved: AppSettings[] = [];
    const store = createSettingsStore({ load: () => ({ cameraAspect: "4:5" }), save: (s) => saved.push(s) });
    expect(store.getState().cameraAspect).toBe("4:5");
    store.getState().update({ holdHintSeen: true });
    expect(saved).toEqual([{ cameraAspect: "4:5", holdHintSeen: true, onboardingSeen: false }]);
  });

  it("si no puede leer ni guardar, sigue funcionando con los valores por defecto", () => {
    const store = createSettingsStore({
      load: () => {
        throw new Error("sin archivo");
      },
      save: () => {
        throw new Error("disco lleno");
      },
    });
    expect(store.getState().cameraAspect).toBe(DEFAULT_SETTINGS.cameraAspect);
    store.getState().update({ cameraAspect: "1:1" });
    expect(store.getState().cameraAspect).toBe("1:1");
  });
});
