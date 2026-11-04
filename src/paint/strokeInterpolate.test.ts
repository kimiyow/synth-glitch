import { expect, it } from "@jest/globals";

import { advanceStroke, stampSeed, type StrokeCursor } from "./strokeInterpolate";

it("coloca un sello al apoyar y luego uno cada `spacing`, sin huecos aunque el dedo salte", () => {
  let cursor: StrokeCursor = null;
  const placed: { x: number; y: number }[] = [];
  for (const [x, y] of [[0, 0], [0.5, 0], [10.2, 0], [10.2, 4]]) {
    const r = advanceStroke(cursor, x, y, 1);
    placed.push(...r.stamps);
    cursor = r.cursor;
  }
  // 0..10 en x (11 sellos) y luego 4 hacia abajo desde 10.
  expect(placed.length).toBe(15);
  for (let i = 1; i < placed.length; i++) {
    const d = Math.hypot(placed[i].x - placed[i - 1].x, placed[i].y - placed[i - 1].y);
    expect(d).toBeCloseTo(1, 6);
  }
});

it("la semilla es determinista y varía entre sellos", () => {
  expect(stampSeed(42, 3, 7)).toBe(stampSeed(42, 3, 7));
  const seeds = new Set(Array.from({ length: 200 }, (_, i) => stampSeed(42, 0, i)));
  expect(seeds.size).toBeGreaterThan(190);
  expect(stampSeed(42, 0, 0)).toBeLessThan(10007);
});
