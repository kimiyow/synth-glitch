import { describe, expect, it } from "@jest/globals";

import { calibrateFloor, dbToUnit, MIC_SILENT, stepMic } from "./micEnvelope";
import { DEFAULT_SOURCES } from "./sources";

const cfg = { ...DEFAULT_SOURCES.mic, floor: -50, ceiling: -10, attack: 0, release: 0, hitThreshold: 0.7 };

describe("envolvente del micrófono (SEN-02)", () => {
  it("convierte dB a 0..1 entre piso y techo", () => {
    expect(dbToUnit(-50, -50, -10)).toBe(0);
    expect(dbToUnit(-30, -50, -10)).toBe(0.5);
    expect(dbToUnit(0, -50, -10)).toBe(1);
    expect(dbToUnit(-90, -50, -10)).toBe(0);
  });

  it("con la sala en silencio (bajo el piso) no hay nivel ni golpes (CA-20)", () => {
    let env = MIC_SILENT;
    for (let i = 0; i < 40; i++) {
      const r = stepMic(env, -60 + Math.sin(i) * 3, 0.05, cfg);
      expect(r.hit).toBe(false);
      env = r.env;
    }
    expect(env.level).toBe(0);
  });

  it("un golpe dispara una vez y se rearma al bajar", () => {
    let env = MIC_SILENT;
    const hits: boolean[] = [];
    for (const db of [-50, -14, -13, -14, -40, -12]) {
      const r = stepMic(env, db, 0.05, cfg);
      hits.push(r.hit);
      env = r.env;
    }
    expect(hits).toEqual([false, true, false, false, false, true]);
  });

  it("ataque y relajación suavizan el nivel", () => {
    const slow = { ...cfg, attack: 0.2, release: 1 };
    const up = stepMic(MIC_SILENT, -10, 0.05, slow).env.level;
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThan(0.5);
    const down = stepMic({ level: 1, above: true }, -50, 0.05, slow).env.level;
    expect(down).toBeGreaterThan(0.9);
  });

  it("calibrar pone el piso sobre el ruido de la sala", () => {
    const next = calibrateFloor([-62, -60, -61, -58], cfg);
    expect(next.floor).toBeGreaterThan(-58);
    expect(next.ceiling - next.floor).toBeGreaterThanOrEqual(10);
    expect(calibrateFloor([], cfg)).toEqual(cfg);
  });
});
