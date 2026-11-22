import { describe, expect, it } from "@jest/globals";

import type { Layer, PaintLayer } from "../domain/types";
import { defaultPaintIndex, moveInStack, PAINT_ROW_ID, paintChainIndex, stackIds } from "./paintStack";

const fx = (id: string, visible = true): Layer => ({ kind: "effect", id, effect: "vhs", params: { x: 0, y: 0 }, visible });
const paint = (index: number): PaintLayer => ({ strokes: [{ id: "s", strokeSeed: 0, stamps: [] }], visible: true, index });

describe("pila con pintura", () => {
  it("coloca la fila de pintura en su lugar", () => {
    expect(stackIds([fx("a"), fx("b")], paint(1))).toEqual(["a", PAINT_ROW_ID, "b"]);
    expect(stackIds([fx("a")], { ...paint(0), strokes: [] })).toEqual(["a"]);
  });

  it("mueve la pintura y las capas", () => {
    const layers = [fx("a"), fx("b"), fx("c")];
    expect(moveInStack(layers, paint(0), PAINT_ROW_ID, 3).paintIndex).toBe(3);
    const moved = moveInStack(layers, paint(1), "c", 0);
    expect(moved.layers.map((l) => l.id)).toEqual(["c", "a", "b"]);
    expect(moved.paintIndex).toBe(2);
  });

  it("cuenta solo capas visibles debajo", () => {
    expect(paintChainIndex([fx("a", false), fx("b"), fx("c")], 2)).toBe(1);
  });

  it("los proyectos anteriores la ponen sobre el último generador en replace", () => {
    const gen: Layer = { kind: "generator", id: "g", generator: "noise", params: { x: 0, y: 0 }, visible: true, blend: "replace" };
    expect(defaultPaintIndex([fx("a"), gen, fx("b")])).toBe(2);
    expect(defaultPaintIndex([fx("a")])).toBe(0);
  });
});
