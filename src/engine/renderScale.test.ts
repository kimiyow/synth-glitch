import { describe, expect, it } from "@jest/globals";

import { FULL_SCALE, stepRenderScale, type RenderScaleState } from "./renderScale";

const run = (start: RenderScaleState, avgMs: number, totalMs: number, dt = 250) => {
  let s = start;
  for (let t = 0; t < totalMs; t += dt) s = stepRenderScale(s, avgMs, dt);
  return s;
};

describe("resolución dinámica (STG-02)", () => {
  it("baja un paso tras 1.5 s lentos y nunca de 0.5", () => {
    expect(run(FULL_SCALE, 25, 1250).scale).toBe(1);
    expect(run(FULL_SCALE, 25, 1500).scale).toBe(0.75);
    expect(run(FULL_SCALE, 25, 10_000).scale).toBe(0.5);
  });

  it("sube un paso tras 5 s holgados", () => {
    const low = { scale: 0.5, slowMs: 0, fastMs: 0 };
    expect(run(low, 10, 4750).scale).toBe(0.5);
    expect(run(low, 10, 5000).scale).toBe(0.75);
    expect(run(low, 10, 60_000).scale).toBe(1);
  });

  it("en la zona intermedia se queda quieta (histéresis)", () => {
    const mid = { scale: 0.75, slowMs: 1000, fastMs: 0 };
    expect(run(mid, 16, 20_000)).toEqual({ scale: 0.75, slowMs: 0, fastMs: 0 });
  });
});
