import { describe, expect, it } from "@jest/globals";
import { assert, constantFrom, integer, property } from "fast-check";

import { ASPECT_RATIO, croppedSize, cropRectFor, cropViewport, fitLongSide, FULL_CROP } from "./crop";

describe("cropRectFor", () => {
  it("free no recorta", () => {
    expect(cropRectFor(4032, 3024, "free")).toEqual(FULL_CROP);
  });

  it("recorta a lo ancho una foto vertical 3:4 para 9:16", () => {
    const [x, y, w, h] = cropRectFor(3024, 4032, "9:16");
    expect(y).toBe(0);
    expect(h).toBe(1);
    expect(w).toBeCloseTo(0.75, 10);
    expect(x).toBeCloseTo(0.125, 10);
  });

  it("recorta a lo alto una foto vertical 3:4 para 1:1", () => {
    const [x, y, w, h] = cropRectFor(3024, 4032, "1:1");
    expect([x, w]).toEqual([0, 1]);
    expect(h).toBeCloseTo(0.75, 10);
    expect(y).toBeCloseTo(0.125, 10);
  });

  it("siempre centrado, dentro de la imagen y con el aspecto pedido", () => {
    assert(
      property(
        integer({ min: 100, max: 8000 }),
        integer({ min: 100, max: 8000 }),
        constantFrom("9:16" as const, "1:1" as const, "4:5" as const),
        (mw, mh, aspect) => {
          const rect = cropRectFor(mw, mh, aspect);
          const [x, y, w, h] = rect;
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + w).toBeLessThanOrEqual(1 + 1e-9);
          expect(y + h).toBeLessThanOrEqual(1 + 1e-9);
          expect(x * 2 + w).toBeCloseTo(1, 9);
          expect(y * 2 + h).toBeCloseTo(1, 9);
          const size = croppedSize(mw, mh, rect);
          expect(size.width / size.height).toBeCloseTo(ASPECT_RATIO[aspect], 6);
        },
      ),
    );
  });
});

describe("fitLongSide", () => {
  it("reduce al lado largo y no agranda", () => {
    expect(fitLongSide({ width: 3024, height: 4032 }, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitLongSide({ width: 300, height: 200 }, 2048)).toEqual({ width: 300, height: 200 });
  });
});

describe("cropViewport", () => {
  it("sin recorte la escena completa coincide con la salida", () => {
    expect(cropViewport(300, 400, FULL_CROP)).toEqual({ fullW: 300, fullH: 400, tx: 0, ty: 0 });
  });

  it("con recorte la región visible ocupa exactamente la salida", () => {
    const rect = cropRectFor(3024, 4032, "9:16");
    const { fullW, fullH, tx, ty } = cropViewport(900, 1600, rect);
    expect(fullW * rect[2]).toBeCloseTo(900, 9);
    expect(fullH * rect[3]).toBeCloseTo(1600, 9);
    expect(tx).toBeCloseTo(fullW * 0.125, 9);
    expect(ty).toBe(0);
  });
});
