import { describe, expect, it } from "@jest/globals";

import type { Layer, Route } from "../state/types";
import { gifDurationS, gifFrameCount } from "./gifTiming";
import { DEFAULT_SOURCES } from "./sources";

const layer: Layer = { kind: "effect", id: "a", effect: "vhs", params: { x: 0.3, y: 0.3 }, visible: true };
const route = (source: Route["source"]): Route => ({
  id: "r",
  source,
  sourceIndex: 0,
  target: { layerId: "a", param: "x" },
  amount: 0.5,
  curve: "lin",
  mode: "add",
});

describe("duración del GIF (3.11)", () => {
  it("sin fuentes periódicas dura 3 s (36 cuadros)", () => {
    const d = gifDurationS([layer], [], DEFAULT_SOURCES);
    expect(d).toBe(3);
    expect(gifFrameCount(d)).toBe(36);
  });

  it("usa el periodo del LFO y nunca pasa de 4 s", () => {
    const slow = { ...DEFAULT_SOURCES, lfo: { ...DEFAULT_SOURCES.lfo, sync: false, rateHz: 0.5, depth: 1 } };
    expect(gifDurationS([layer], [route("lfo")], slow)).toBe(2);
    const slower = { ...slow, lfo: { ...slow.lfo, rateHz: 0.1 } };
    expect(gifDurationS([layer], [route("lfo")], slower)).toBe(4);
  });

  it("un periodo corto se repite hasta durar al menos 1 s", () => {
    const fast = { ...DEFAULT_SOURCES, lfo: { ...DEFAULT_SOURCES.lfo, sync: false, rateHz: 3, depth: 1 } };
    expect(gifDurationS([layer], [route("lfo")], fast)).toBeCloseTo(1);
  });

  it("ignora rutas de capas ocultas y fuentes en vivo", () => {
    expect(gifDurationS([{ ...layer, visible: false }], [route("lfo")], DEFAULT_SOURCES)).toBe(3);
    expect(gifDurationS([layer], [route("mic")], DEFAULT_SOURCES)).toBe(3);
  });
});
