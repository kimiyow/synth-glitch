import { describe, expect, it } from "@jest/globals";
import { assert, constantFrom, double, property } from "fast-check";

import type { Route } from "../state/types";
import { evaluate, NO_INPUTS } from "./evaluate";
import { adsrValue, DEFAULT_SOURCES as S, lfoValue, LFO_SHAPES, parseSources, seqIndex } from "./sources";
import { tapTempo } from "./tempo";

const layer = { id: "a", params: { x: 0.5, y: 0.2 } };
const route = (p: Partial<Route>): Route => ({
  id: "r",
  source: "lfo",
  sourceIndex: 0,
  target: { layerId: "a", param: "x" },
  amount: 0.5,
  curve: "lin",
  mode: "add",
  ...p,
});

describe("evaluate", () => {
  it("sin rutas devuelve la base", () => {
    expect(evaluate([layer], [], S, 3, NO_INPUTS, 1)).toEqual([0.5, 0.2]);
  });

  it("es determinista y siempre queda en 0..1", () => {
    assert(
      property(
        double({ min: 0, max: 600, noNaN: true }),
        constantFrom(...LFO_SHAPES),
        double({ min: -1, max: 1, noNaN: true }),
        (t, shape, amount) => {
          const sources = { ...S, lfo: { ...S.lfo, shape } };
          const routes = [route({ amount }), route({ id: "s", source: "sh", target: { layerId: "a", param: "y" }, amount })];
          const a = evaluate([layer], routes, sources, t, NO_INPUTS, 9);
          expect(evaluate([layer], routes, sources, t, NO_INPUTS, 9)).toEqual(a);
          for (const v of a) expect(v >= 0 && v <= 1).toBe(true);
        },
      ),
    );
  });

  it("suma: LFO seno a 1/4 de ciclo suma la cantidad completa", () => {
    const t = 0.25 / S.lfo.rateHz;
    expect(evaluate([layer], [route({})], S, t, NO_INPUTS, 1)[0]).toBeCloseTo(1, 6);
  });

  it("reemplazo: SEQ sustituye la base", () => {
    const r = route({ source: "seq", mode: "replace", amount: 1 });
    expect(evaluate([layer], [r], S, 0, NO_INPUTS, 1)[0]).toBeCloseTo(S.seq.steps[0], 6);
  });
});

describe("fuentes", () => {
  it("LFO en rango y sincronizado al tempo", () => {
    const lfo = { ...S.lfo, sync: true, division: 1, shape: "saw" as const };
    // 120 BPM, 1 pulso por ciclo → 2 Hz: a 0.25 s está a media rampa.
    expect(lfoValue(lfo, 120, 0.25, 0)).toBeCloseTo(0, 6);
  });

  it("ADSR: ataque, sostenimiento y relajación", () => {
    const a = { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.4 };
    expect(adsrValue(a, 0.05, 0, null)).toBeCloseTo(0.5, 6);
    expect(adsrValue(a, 1, 0, null)).toBeCloseTo(0.5, 6);
    expect(adsrValue(a, 1.2, 0, 1)).toBeCloseTo(0.25, 6);
    expect(adsrValue(a, 2, 0, 1)).toBe(0);
  });

  it("secuenciador: adelante, atrás e ida y vuelta", () => {
    const seq = { ...S.seq, division: 1 }; // 120 BPM → paso cada 0.5 s
    expect(seqIndex(seq, 120, 0.6, 0)).toBe(1);
    expect(seqIndex({ ...seq, direction: "backward" }, 120, 0.6, 0)).toBe(6);
    expect(seqIndex({ ...seq, direction: "pingpong" }, 120, 0.5 * 9, 0)).toBe(5);
  });

  it("proyectos sin fuentes toman los valores por defecto", () => {
    expect(parseSources({})).toEqual(S);
    expect(parseSources({ tempo: { bpm: 999 } }).tempo.bpm).toBe(220);
  });
});

it("tap tempo promedia y se reinicia tras 2 s", () => {
  let st = tapTempo([], 0);
  st = tapTempo(st.taps, 500);
  st = tapTempo(st.taps, 1000);
  expect(st.bpm).toBe(120);
  expect(tapTempo(st.taps, 5000)).toEqual({ taps: [5000], bpm: null });
});
