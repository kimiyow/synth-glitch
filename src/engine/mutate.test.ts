import { describe, expect, it } from "@jest/globals";

import type { Layer, Route } from "../domain/types";
import { hasFastLuminanceRoute } from "../modulation/safety";
import { DEFAULT_SOURCES } from "../modulation/sources";
import { mutateScene, randomScene } from "./mutate";

const layers: Layer[] = [{ kind: "effect", id: "a", effect: "vhs", params: { x: 0.5, y: 0.5 }, visible: true }];
const routes: Route[] = [
  {
    id: "r",
    source: "lfo",
    sourceIndex: 0,
    target: { layerId: "a", param: "x" },
    amount: 0.5,
    curve: "lin",
    mode: "add",
    settings: { lfo: { ...DEFAULT_SOURCES.lfo } },
  },
];

describe("mutar", () => {
  it("misma semilla, misma variación; conserva capas y fuentes", () => {
    const a = mutateScene(layers, routes, 42, "medium", 120);
    expect(mutateScene(layers, routes, 42, "medium", 120)).toEqual(a);
    expect(a.layers.map((l) => l.id)).toEqual(["a"]);
    expect(a.routes.map((r) => r.source)).toEqual(["lfo"]);
    expect(a.layers[0].params).not.toEqual(layers[0].params);
  });

  it("sutil se aleja menos que fuerte", () => {
    const d = (lv: "subtle" | "strong") => {
      let total = 0;
      for (let s = 1; s <= 50; s++) total += Math.abs(mutateScene(layers, routes, s, lv, 120).layers[0].params.x - 0.5);
      return total;
    };
    expect(d("subtle")).toBeLessThan(d("strong"));
  });
});

describe("aleatorizar", () => {
  it("2 o 3 efectos distintos, con modulaciones válidas y sin destellos rápidos", () => {
    for (let s = 1; s <= 100; s++) {
      const out = randomScene(s, DEFAULT_SOURCES);
      expect(out.layers.length).toBeGreaterThanOrEqual(2);
      expect(out.layers.length).toBeLessThanOrEqual(3);
      expect(new Set(out.layers.map((l) => (l.kind === "effect" ? l.effect : ""))).size).toBe(out.layers.length);
      const ids = new Set(out.layers.map((l) => l.id));
      for (const r of out.routes) expect(ids.has(r.target.layerId)).toBe(true);
      expect(hasFastLuminanceRoute(out.layers, out.routes, DEFAULT_SOURCES)).toBe(false);
      // también con un tempo rápido
      const fast = { ...DEFAULT_SOURCES, tempo: { bpm: 220 } };
      const f = randomScene(s, fast);
      expect(hasFastLuminanceRoute(f.layers, f.routes, fast)).toBe(false);
    }
  });
});
