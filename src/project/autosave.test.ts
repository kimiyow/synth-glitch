import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import type { Project } from "../state/types";
import { createAutosave, type SaveStatus } from "./autosave";
import { createProject } from "./schema";

const base = createProject({ id: "p", media: { kind: "generative", width: 1, height: 1 }, seed: 1, now: new Date(0) });
const named = (name: string): Project => ({ ...base, name });

describe("autosave", () => {
  let written: string[];
  let statuses: SaveStatus["state"][];
  let failNext: boolean;

  const make = () =>
    createAutosave({
      write: (p) => {
        if (failNext) {
          failNext = false;
          throw new Error("disco lleno");
        }
        written.push(p.name);
      },
      onStatus: (s) => statuses.push(s.state),
    });

  beforeEach(() => {
    jest.useFakeTimers();
    written = [];
    statuses = [];
    failNext = false;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("guarda un segundo después del último cambio", () => {
    const a = make();
    a.schedule(named("1"));
    jest.advanceTimersByTime(600);
    a.schedule(named("2"));
    jest.advanceTimersByTime(999);
    expect(written).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(written).toEqual(["2"]);
    expect(statuses).toEqual(["pending", "pending", "saving", "saved"]);
  });

  it("flush guarda ya y no vuelve a guardar después", () => {
    const a = make();
    a.schedule(named("1"));
    a.flush();
    jest.advanceTimersByTime(5000);
    expect(written).toEqual(["1"]);
    expect(a.hasPending()).toBe(false);
  });

  it("flush sin cambios no escribe", () => {
    make().flush();
    expect(written).toEqual([]);
  });

  it("si falla queda en error y se puede reintentar", () => {
    const a = make();
    failNext = true;
    a.schedule(named("1"));
    jest.advanceTimersByTime(1000);
    expect(statuses.at(-1)).toBe("error");
    expect(a.hasPending()).toBe(true);
    a.flush();
    expect(written).toEqual(["1"]);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("cancel descarta lo pendiente", () => {
    const a = make();
    a.schedule(named("1"));
    a.cancel();
    jest.advanceTimersByTime(5000);
    expect(written).toEqual([]);
  });
});
