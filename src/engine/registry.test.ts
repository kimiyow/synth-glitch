import { describe, expect, it } from "@jest/globals";

import type { EffectId } from "../state/types";
import { UNIFORM_NAMES } from "./effects/contract";
import { EFFECTS, EFFECT_BY_ID } from "./registry";

const ALL_IDS: EffectId[] = ["chromatic", "scanlines", "datamosh", "vhs", "pixelate", "wave", "crt"];

describe("registro de efectos", () => {
  it("tiene los 7 efectos de FX-01 en orden", () => {
    expect(EFFECTS.map((e) => e.id)).toEqual(ALL_IDS);
  });

  it("usa los valores por defecto de la tabla 6.3", () => {
    expect(EFFECT_BY_ID.chromatic.defaults).toEqual({ x: 0.3, y: 0.0 });
    expect(EFFECT_BY_ID.scanlines.defaults).toEqual({ x: 0.4, y: 0.2 });
    expect(EFFECT_BY_ID.datamosh.defaults).toEqual({ x: 0.3, y: 0.3 });
    expect(EFFECT_BY_ID.vhs.defaults).toEqual({ x: 0.3, y: 0.4 });
    expect(EFFECT_BY_ID.pixelate.defaults).toEqual({ x: 0.25, y: 0.0 });
    expect(EFFECT_BY_ID.wave.defaults).toEqual({ x: 0.3, y: 0.3 });
    expect(EFFECT_BY_ID.crt.defaults).toEqual({ x: 0.25, y: 0.5 });
  });

  it("usa las muestras por píxel de 3.4", () => {
    const samples = Object.fromEntries(EFFECTS.map((e) => [e.id, e.samples]));
    expect(samples).toEqual({ chromatic: 3, scanlines: 1, datamosh: 1, vhs: 2, pixelate: 1, wave: 1, crt: 2 });
  });

  it.each(ALL_IDS)("%s declara el contrato de uniforms y una sola main", (id) => {
    const sksl = EFFECT_BY_ID[id].sksl;
    expect(sksl).toMatch(/uniform shader image;/);
    for (const name of UNIFORM_NAMES) {
      expect(sksl).toMatch(new RegExp(`uniform float\\d? ${name};`));
    }
    expect(sksl.match(/half4 main\(float2 xy\)/g)).toHaveLength(1);
  });
});
