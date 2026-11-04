import { parseSources } from "../modulation/sources";
import { MAX_LAYERS } from "../engine/layerCost";
import type { Scene, SynthFx } from "../state/types";
import { Invalid, parseLayer, parseRoute, type ValidationResult } from "./schema";

/**
 * `.synthfx` (SEN-05, ADR-12): receta declarativa de una escena (capas, rutas, fuentes y
 * semilla), sin pintura ni SkSL propio. Funciones puras: el archivo lo leen y escriben
 * los adaptadores de plataforma.
 */
export const SYNTHFX_EXTENSION = "synthfx";
/** NFR-12: un archivo mayor se rechaza antes de leerlo. */
export const SYNTHFX_MAX_BYTES = 200 * 1024;

export function createSynthFx(name: string, scene: Scene): SynthFx {
  return { synthfx: 1, name, layers: scene.layers, routes: scene.routes, sources: scene.sources, seed: scene.seed };
}

export function serializeSynthFx(fx: SynthFx): string {
  return JSON.stringify(fx, null, 2);
}

/** Nombre de archivo seguro a partir del nombre del proyecto. */
export function synthFxFileName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return `${base || "escena"}.${SYNTHFX_EXTENSION}`;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Valida contra el esquema y los límites (NFR-12). Devuelve una copia limpia. */
export function parseSynthFx(text: string): ValidationResult<SynthFx> {
  if (byteLength(text) > SYNTHFX_MAX_BYTES) return { ok: false, error: "ARCHIVO DEMASIADO GRANDE · MÁXIMO 200 KB" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "ARCHIVO DAÑADO · NO ES UN .SYNTHFX" };
  }
  try {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Invalid("NO ES UN .SYNTHFX");
    const o = raw as Record<string, unknown>;
    if (o.synthfx !== 1) throw new Invalid("VERSIÓN DE .SYNTHFX NO COMPATIBLE");
    if (typeof o.name !== "string") throw new Invalid("name: se esperaba un texto");
    if (!Array.isArray(o.layers) || !Array.isArray(o.routes)) throw new Invalid("faltan las capas o las rutas");
    if (o.layers.length > MAX_LAYERS) throw new Invalid(`MÁS DE ${MAX_LAYERS} CAPAS`);
    if (typeof o.seed !== "number" || !Number.isFinite(o.seed)) throw new Invalid("seed: se esperaba un número");

    const layers = o.layers.map((l, i) => parseLayer(l, `layers[${i}]`));
    const ids = new Set(layers.map((l) => l.id));
    if (ids.size !== layers.length) throw new Invalid("HAY CAPAS CON EL MISMO ID");
    const routes = o.routes.map((r, i) => parseRoute(r, `routes[${i}]`));
    for (const r of routes) {
      if (!ids.has(r.target.layerId)) throw new Invalid(`la ruta ${r.id} apunta a una capa que no existe`);
    }
    return {
      ok: true,
      value: {
        synthfx: 1,
        name: o.name.slice(0, 40),
        layers,
        routes,
        // Las fuentes se completan con valores por defecto y se recortan a sus rangos.
        sources: parseSources(o.sources),
        seed: Math.floor(Math.abs(o.seed)) % 2 ** 31,
      },
    };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: `.SYNTHFX INVÁLIDO · ${error.message}` };
    throw error;
  }
}

/** Aplica la receta a una escena: reemplaza capas, rutas, fuentes y semilla; conserva la pintura. */
export function applySynthFx(scene: Scene, fx: SynthFx): void {
  scene.layers = fx.layers.map((l) => ({ ...l, params: { ...l.params } }));
  scene.routes = fx.routes.map((r) => ({ ...r, target: { ...r.target } }));
  scene.sources = fx.sources;
  scene.seed = fx.seed;
}
