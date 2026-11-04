import { describe, expect, it } from "@jest/globals";
import { array, assert, double, property } from "fast-check";

import { addFrame, emptyFrameWindow, summarizeIfDue } from "./frameWindow";

describe("frameWindow", () => {
  it("no resume antes de cubrir la ventana", () => {
    const w = addFrame(emptyFrameWindow(0), 16);
    expect(summarizeIfDue(w, 499)).toBeNull();
  });

  it("no resume una ventana sin cuadros", () => {
    expect(summarizeIfDue(emptyFrameWindow(0), 1000)).toBeNull();
  });

  it("calcula fps, promedio y máximo", () => {
    let w = emptyFrameWindow(0);
    for (const ms of [16, 16, 20, 12]) w = addFrame(w, ms);
    const s = summarizeIfDue(w, 500);
    expect(s).toEqual({ fps: 8, avgMs: 16, maxMs: 20 });
  });

  it("el promedio queda entre el mínimo y el máximo", () => {
    assert(
      property(
        array(double({ min: 0.1, max: 200, noNaN: true }), { minLength: 1, maxLength: 200 }),
        (frames) => {
          const w = frames.reduce(addFrame, emptyFrameWindow(0));
          const s = summarizeIfDue(w, 1000);
          expect(s).not.toBeNull();
          expect(s!.avgMs).toBeLessThanOrEqual(s!.maxMs + 1e-9);
          expect(s!.avgMs).toBeGreaterThanOrEqual(Math.min(...frames) - 1e-9);
        },
      ),
    );
  });
});
