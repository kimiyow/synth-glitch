import type { SceneConfig, UndoEntry, UndoState } from "../state/types";

export const MAX_UNDO_ENTRIES = 50;

export function cloneSceneConfig(scene: SceneConfig): SceneConfig {
  return {
    layers: scene.layers.map((layer) => ({
      ...layer,
      params: { ...layer.params },
      lfoX: { ...layer.lfoX },
      lfoY: { ...layer.lfoY },
    })),
    gyroOnY: scene.gyroOnY,
    track: scene.track
      ? {
          ...scene.track,
          layerIds: [...scene.track.layerIds],
          samples: [...scene.track.samples],
        }
      : null,
  };
}

export function scenesEqual(a: SceneConfig, b: SceneConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function commitSceneChange(
  history: UndoState,
  before: SceneConfig,
  after: SceneConfig,
  label: string,
): UndoState {
  if (scenesEqual(before, after)) {
    return history;
  }

  const entry: UndoEntry = {
    label,
    before: cloneSceneConfig(before),
    after: cloneSceneConfig(after),
  };

  return {
    past: [...history.past, entry].slice(-MAX_UNDO_ENTRIES),
    future: [],
  };
}

export function takeUndo(
  history: UndoState,
): { history: UndoState; entry: UndoEntry | null } {
  const entry = history.past[history.past.length - 1] ?? null;
  if (!entry) {
    return { history, entry: null };
  }

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [entry, ...history.future],
    },
    entry,
  };
}

export function takeRedo(
  history: UndoState,
): { history: UndoState; entry: UndoEntry | null } {
  const entry = history.future[0] ?? null;
  if (!entry) {
    return { history, entry: null };
  }

  return {
    history: {
      past: [...history.past, entry].slice(-MAX_UNDO_ENTRIES),
      future: history.future.slice(1),
    },
    entry,
  };
}
