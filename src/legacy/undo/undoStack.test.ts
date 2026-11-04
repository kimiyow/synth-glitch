import { describe, expect, it } from "@jest/globals";
import type { Layer, SceneConfig, UndoState } from "../state/types";
import {
  commitSceneChange,
  MAX_UNDO_ENTRIES,
  takeRedo,
  takeUndo,
} from "./undoStack";

function createScene(): SceneConfig {
  const layer: Layer = {
    id: "layer-1",
    effect: "chromatic",
    params: { x: 0.3, y: 0.2 },
    lfoX: { enabled: false, shape: "sine", rateHz: 1, depth: 0 },
    lfoY: { enabled: false, shape: "sine", rateHz: 1, depth: 0 },
    visible: true,
  };
  return { layers: [layer], gyroOnY: false, track: null };
}

describe("scene undo history", () => {
  it("ignores no-op changes", () => {
    const history: UndoState = { past: [], future: [] };
    const scene = createScene();

    expect(commitSceneChange(history, scene, scene, "NO OP")).toBe(history);
  });

  it("stores an independent snapshot and supports undo and redo", () => {
    const before = createScene();
    const after = createScene();
    after.layers[0].params.x = 0.8;

    const committed = commitSceneChange(
      { past: [], future: [] },
      before,
      after,
      "MOVER CAPA",
    );
    after.layers[0].params.x = 0.1;

    const undone = takeUndo(committed);
    expect(undone.entry?.before.layers[0].params.x).toBe(0.3);
    expect(undone.entry?.after.layers[0].params.x).toBe(0.8);

    const redone = takeRedo(undone.history);
    expect(redone.entry?.after.layers[0].params.x).toBe(0.8);
    expect(redone.history.future).toHaveLength(0);
  });

  it("clears redo entries after a new change", () => {
    const before = createScene();
    const after = createScene();
    after.layers[0].visible = false;
    const first = commitSceneChange({ past: [], future: [] }, before, after, "OCULTAR");
    const undone = takeUndo(first);
    const next = createScene();
    next.layers[0].params.y = 0.9;

    expect(
      commitSceneChange(undone.history, before, next, "AJUSTAR"),
    ).toMatchObject({ future: [] });
  });

  it("limits the history to fifty changes", () => {
    let history: UndoState = { past: [], future: [] };
    let scene = createScene();
    for (let index = 0; index < MAX_UNDO_ENTRIES + 1; index += 1) {
      const next = createScene();
      next.layers[0].params.x = (index + 1) / 100;
      history = commitSceneChange(history, scene, next, "AJUSTAR");
      scene = next;
    }

    expect(history.past).toHaveLength(MAX_UNDO_ENTRIES);
  });
});
