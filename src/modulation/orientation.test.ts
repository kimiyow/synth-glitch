import { describe, expect, it } from "@jest/globals";

import { relativeTilt, shapeTilt } from "./orientation";

const upright = { x: 0, y: -1, z: 0 };
const flat = { x: 0, y: 0, z: -1 };
const s = Math.SQRT1_2 / 2; // ~20°

describe("inclinación relativa", () => {
  it("en la posición neutral es cero", () => {
    expect(relativeTilt(upright, upright)).toEqual({ x: 0, y: 0 });
    expect(relativeTilt(flat, flat)).toEqual({ x: 0, y: 0 });
  });

  it("inclinar a la derecha da +x, vertical o acostado", () => {
    expect(relativeTilt(upright, { x: s, y: -Math.sqrt(1 - s * s), z: 0 }).x).toBeGreaterThan(0.5);
    expect(relativeTilt(flat, { x: s, y: 0, z: -Math.sqrt(1 - s * s) }).x).toBeGreaterThan(0.5);
  });

  it("alejar la parte de arriba da +y, vertical o acostado", () => {
    // vertical: la pantalla mira un poco hacia arriba → la gravedad gana −z
    expect(relativeTilt(upright, { x: 0, y: -Math.sqrt(1 - s * s), z: -s }).y).toBeGreaterThan(0.5);
    // acostado: el borde de arriba baja → la gravedad gana +y
    expect(relativeTilt(flat, { x: 0, y: s, z: -Math.sqrt(1 - s * s) }).y).toBeGreaterThan(0.5);
  });

  it("zona muerta y sensibilidad", () => {
    expect(shapeTilt(0.03, 0.04, 1)).toBe(0);
    expect(shapeTilt(1, 0.04, 1)).toBeCloseTo(1, 6);
    expect(shapeTilt(0.5, 0, 4)).toBe(1);
  });
});
