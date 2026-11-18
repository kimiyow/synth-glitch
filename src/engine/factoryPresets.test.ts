import { describe, expect, it } from "@jest/globals";

import { hasFastLuminanceRoute } from "../modulation/safety";
import { DEFAULT_SOURCES } from "../modulation/sources";
import { FACTORY_PRESETS } from "./factoryPresets";

describe("presets de fábrica", () => {
  it("son 3, sus rutas apuntan a sus capas y no generan destellos rápidos", () => {
    expect(FACTORY_PRESETS).toHaveLength(3);
    for (const p of FACTORY_PRESETS) {
      const ids = new Set(p.layers.map((l) => l.id));
      for (const r of p.routes) expect(ids.has(r.target.layerId)).toBe(true);
      expect(hasFastLuminanceRoute(p.layers, p.routes, DEFAULT_SOURCES)).toBe(false);
    }
  });
});
