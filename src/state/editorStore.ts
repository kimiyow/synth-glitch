import { create } from "zustand";
import {
  DEFAULT_EFFECT_ID,
  EFFECT_BY_ID,
  type EffectId,
} from "../effects/registry";
import { MAX_LAYER_COUNT } from "../layers/layerCost";
import {
  cloneSceneConfig,
  commitSceneChange,
  takeRedo,
  takeUndo,
} from "../undo/undoStack";
import type { SceneConfig, UndoState } from "./types";

export type ActiveMedia = {
  uri: string;
  type: "photo" | "clip";
  width: number;
  height: number;
};

type EditorState = {
  activeMedia: ActiveMedia | null;
  scene: SceneConfig;
  activeLayerId: string;
  undoState: UndoState;
  lastChangeLabel: string | null;
  setActiveMedia: (media: ActiveMedia) => void;
  clearActiveMedia: () => void;
  setActiveLayer: (layerId: string) => void;
  commitScene: (label: string, scene: SceneConfig) => void;
  undo: () => void;
  redo: () => void;
  clearChangeLabel: () => void;
};

const EMPTY_UNDO_STATE: UndoState = { past: [], future: [] };

function createLayerId() {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLayer(effect: EffectId = DEFAULT_EFFECT_ID) {
  return {
    id: createLayerId(),
    effect,
    params: { ...EFFECT_BY_ID[effect].defaultControl },
    lfoX: { enabled: false, shape: "sine" as const, rateHz: 1, depth: 0 },
    lfoY: { enabled: false, shape: "sine" as const, rateHz: 1, depth: 0 },
    visible: true,
  };
}

export function createInitialScene(): SceneConfig {
  return {
    layers: [createLayer()],
    gyroOnY: false,
    track: null,
  };
}

function assertScene(scene: SceneConfig) {
  if (scene.layers.length < 1 || scene.layers.length > MAX_LAYER_COUNT) {
    throw new RangeError(`La escena debe tener entre 1 y ${MAX_LAYER_COUNT} capas.`);
  }
}

export const useEditorStore = create<EditorState>((set) => ({
  activeMedia: null,
  scene: createInitialScene(),
  activeLayerId: "",
  undoState: EMPTY_UNDO_STATE,
  lastChangeLabel: null,
  setActiveMedia: (activeMedia) => {
    const scene = createInitialScene();
    set({
      activeMedia,
      scene,
      activeLayerId: scene.layers[0].id,
      undoState: { past: [], future: [] },
      lastChangeLabel: null,
    });
  },
  clearActiveMedia: () => {
    const scene = createInitialScene();
    set({
      activeMedia: null,
      scene,
      activeLayerId: scene.layers[0].id,
      undoState: { past: [], future: [] },
      lastChangeLabel: null,
    });
  },
  setActiveLayer: (activeLayerId) =>
    set((state) =>
      state.scene.layers.some((layer) => layer.id === activeLayerId)
        ? { activeLayerId }
        : state,
    ),
  commitScene: (label, nextScene) => {
    assertScene(nextScene);
    set((state) => {
      const undoState = commitSceneChange(
        state.undoState,
        state.scene,
        nextScene,
        label,
      );
      if (undoState === state.undoState) {
        return state;
      }

      const scene = cloneSceneConfig(nextScene);
      const activeLayerId = scene.layers.some(
        (layer) => layer.id === state.activeLayerId,
      )
        ? state.activeLayerId
        : scene.layers[0].id;
      return {
        scene,
        activeLayerId,
        undoState,
        lastChangeLabel: label,
      };
    });
  },
  undo: () =>
    set((state) => {
      const result = takeUndo(state.undoState);
      if (!result.entry) {
        return state;
      }
      const scene = cloneSceneConfig(result.entry.before);
      const activeLayerId = scene.layers.some(
        (layer) => layer.id === state.activeLayerId,
      )
        ? state.activeLayerId
        : scene.layers[0].id;
      return {
        scene,
        activeLayerId,
        undoState: result.history,
        lastChangeLabel: `DESHACER · ${result.entry.label}`,
      };
    }),
  redo: () =>
    set((state) => {
      const result = takeRedo(state.undoState);
      if (!result.entry) {
        return state;
      }
      const scene = cloneSceneConfig(result.entry.after);
      const activeLayerId = scene.layers.some(
        (layer) => layer.id === state.activeLayerId,
      )
        ? state.activeLayerId
        : scene.layers[0].id;
      return {
        scene,
        activeLayerId,
        undoState: result.history,
        lastChangeLabel: `REHACER · ${result.entry.label}`,
      };
    }),
  clearChangeLabel: () => set({ lastChangeLabel: null }),
}));
