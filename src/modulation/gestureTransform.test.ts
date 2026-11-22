import type { GestureClip } from "../domain/types";
import { gesturePeriodS, gestureValue } from "./sources";

// gesto de 1 s y 11 muestras: x sube de 0 a 1, y fija en 0.2
const samples = Array.from({ length: 11 }, (_, i) => [i / 10, 0.2]).flat();
const clip = (extra: Partial<GestureClip> = {}): GestureClip => ({ durationMs: 1000, samples, loop: "cut", ...extra });

describe("transformaciones del gesto", () => {
  it("sin transformaciones reproduce lo grabado", () => {
    expect(gestureValue(clip(), 0.5, 0)).toBeCloseTo(0.5);
  });

  it("la velocidad acorta o alarga el bucle", () => {
    expect(gestureValue(clip({ speed: 2 }), 0.25, 0)).toBeCloseTo(0.5);
    expect(gesturePeriodS(clip({ speed: 0.5 }))).toBeCloseTo(2);
  });

  it("reversa empieza por el final", () => {
    expect(gestureValue(clip({ direction: "reverse" }), 0, 0)).toBeCloseTo(1);
    expect(gestureValue(clip({ direction: "reverse" }), 0.75, 0)).toBeCloseTo(0.25);
  });

  it("ida y vuelta va y regresa sin salto, con periodo doble", () => {
    const g = clip({ direction: "pingpong" });
    expect(gesturePeriodS(g)).toBeCloseTo(2);
    expect(gestureValue(g, 0.5, 0)).toBeCloseTo(0.5);
    expect(gestureValue(g, 1.5, 0)).toBeCloseTo(0.5);
    expect(gestureValue(g, 1.99, 0)).toBeCloseTo(0.01, 1);
  });

  it("el espejo invierte solo su eje", () => {
    const g = clip({ mirrorY: true });
    expect(gestureValue(g, 0.5, 0)).toBeCloseTo(0.5);
    expect(gestureValue(g, 0.5, 1)).toBeCloseTo(0.8);
  });
});
