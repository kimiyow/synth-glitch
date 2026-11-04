/**
 * Compila cada SkSL con CanvasKit (el mismo compilador de Skia, en wasm) para
 * detectar shaders rotos sin el teléfono. En JS para usar `path` sin tipos de Node.
 * @jest-environment node
 */
const { beforeAll, describe, expect, it } = require("@jest/globals");
const path = require("path");

const { EFFECTS, GENERATORS } = require("./registry");

const CK_DIR = path.join(path.dirname(require.resolve("canvaskit-wasm/package.json")), "bin/full");
let CK;

beforeAll(async () => {
  const init = require(path.join(CK_DIR, "canvaskit.js"));
  CK = await init({ locateFile: (file) => path.join(CK_DIR, file) });
}, 30_000);

describe("SkSL de los efectos", () => {
  it.each(EFFECTS.map((e) => [e.id, e.sksl]))("%s compila con el contrato", (_id, sksl) => {
    let error = "";
    const effect = CK.RuntimeEffect.Make(sksl, (m) => (error += m));
    expect(error).toBe("");
    expect(effect).not.toBeNull();
    const names = Array.from({ length: effect.getUniformCount() }, (_, i) => effect.getUniformName(i));
    expect(names).toEqual(["resolution", "param", "time", "seed"]);
  });
});

describe("SkSL de los generadores", () => {
  it.each(GENERATORS.map((g) => [g.id, g.sksl]))("%s compila con el contrato y blend", (_id, sksl) => {
    let error = "";
    const effect = CK.RuntimeEffect.Make(sksl, (m) => (error += m));
    expect(error).toBe("");
    expect(effect).not.toBeNull();
    const names = Array.from({ length: effect.getUniformCount() }, (_, i) => effect.getUniformName(i));
    expect(names).toEqual(["resolution", "param", "time", "seed", "blend"]);
  });
});

describe("SkSL de los sellos", () => {
  const { STAMP_SKSL } = require("./stamps/stamps");
  it.each(Object.entries(STAMP_SKSL))("%s compila con rect, seed y sp", (_id, sksl) => {
    let error = "";
    const effect = CK.RuntimeEffect.Make(sksl, (m) => (error += m));
    expect(error).toBe("");
    expect(effect).not.toBeNull();
    const names = Array.from({ length: effect.getUniformCount() }, (_, i) => effect.getUniformName(i));
    expect(names).toEqual(["rect", "seed", "sp"]);
  });
});
