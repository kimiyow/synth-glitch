import { DEFAULT_SOURCES, parseSources } from "../modulation/sources";
import type {
  CropAspect,
  EffectId,
  GeneratorId,
  GestureTrack,
  Layer,
  PaintLayer,
  Project,
  Route,
  Scene,
  Stamp,
  StampEffect,
} from "../state/types";

/** Versión actual de `project.json` (SDD 3.7). */
export const SCHEMA_VERSION = 1;
/** Límite de trazos por proyecto (3.6). */
export const MAX_STROKES = 400;

const EFFECT_IDS: readonly EffectId[] = ["chromatic", "scanlines", "datamosh", "vhs", "pixelate", "wave", "crt"];
const GENERATOR_IDS: readonly GeneratorId[] = ["noise", "bars", "voronoi"];
const STAMP_EFFECTS: readonly StampEffect[] = ["datamosh", "chromatic", "pixel", "smear"];
const BLENDS = ["replace", "screen", "multiply", "difference"] as const;
const SOURCES = ["touch", "lfo", "adsr", "sh", "seq", "orientation", "mic", "track", "tempo"] as const;
const CURVES = ["lin", "exp", "log", "scurve"] as const;
const ASPECTS: readonly CropAspect[] = ["9:16", "1:1", "4:5", "free"];
const MEDIA_KINDS = ["photo", "clip", "generative"] as const;

// ---------------------------------------------------------------- creación

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** Nombre por defecto (PRJ-01): fecha y hora local, p. ej. "3 NOV 14:32". */
export function defaultProjectName(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${hh}:${mm}`;
}

export function createScene(media: Scene["media"], seed: number): Scene {
  return {
    media,
    crop: { aspect: "free", rect: [0, 0, 1, 1] },
    paint: { strokes: [] },
    layers: [],
    routes: [],
    sources: JSON.parse(JSON.stringify(DEFAULT_SOURCES)),
    tracks: [],
    seed,
  };
}

export function createProject(args: { id: string; media: Scene["media"]; seed: number; now: Date }): Project {
  const iso = args.now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: args.id,
    name: defaultProjectName(args.now),
    createdAt: iso,
    updatedAt: iso,
    scene: createScene(args.media, args.seed),
  };
}

// ---------------------------------------------------------------- validación

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

class Invalid extends Error {}

function fail(path: string, expected: string): never {
  throw new Invalid(`${path}: se esperaba ${expected}`);
}

function obj(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(path, "un objeto");
  return v as Record<string, unknown>;
}
function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, "una lista");
  return v;
}
function num(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(path, "un número");
  return v;
}
function unit(v: unknown, path: string): number {
  const n = num(v, path);
  if (n < 0 || n > 1) fail(path, "un número entre 0 y 1");
  return n;
}
function str(v: unknown, path: string): string {
  if (typeof v !== "string") fail(path, "un texto");
  return v;
}
function bool(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") fail(path, "verdadero o falso");
  return v;
}
function oneOf<T extends string>(v: unknown, options: readonly T[], path: string): T {
  if (typeof v !== "string" || !options.includes(v as T)) fail(path, options.join(" | "));
  return v as T;
}
function xy(v: unknown, path: string): { x: number; y: number } {
  const o = obj(v, path);
  return { x: unit(o.x, `${path}.x`), y: unit(o.y, `${path}.y`) };
}

function stamp(v: unknown, path: string): Stamp {
  const o = obj(v, path);
  return {
    x: num(o.x, `${path}.x`),
    y: num(o.y, `${path}.y`),
    size: num(o.size, `${path}.size`),
    effect: oneOf(o.effect, STAMP_EFFECTS, `${path}.effect`),
    erase: bool(o.erase, `${path}.erase`),
    params: arr(o.params, `${path}.params`).map((p, i) => num(p, `${path}.params[${i}]`)),
    seed: num(o.seed, `${path}.seed`),
  };
}

function paint(v: unknown, path: string): PaintLayer {
  const strokes = arr(obj(v, path).strokes, `${path}.strokes`);
  if (strokes.length > MAX_STROKES) fail(`${path}.strokes`, `como máximo ${MAX_STROKES} trazos`);
  return {
    strokes: strokes.map((s, i) => {
      const p = `${path}.strokes[${i}]`;
      const o = obj(s, p);
      return {
        id: str(o.id, `${p}.id`),
        strokeSeed: num(o.strokeSeed, `${p}.strokeSeed`),
        stamps: arr(o.stamps, `${p}.stamps`).map((st, j) => stamp(st, `${p}.stamps[${j}]`)),
      };
    }),
  };
}

export function parseLayer(v: unknown, path: string): Layer {
  const o = obj(v, path);
  const kind = oneOf(o.kind, ["effect", "generator"] as const, `${path}.kind`);
  const base = {
    id: str(o.id, `${path}.id`),
    params: xy(o.params, `${path}.params`),
    visible: bool(o.visible, `${path}.visible`),
  };
  if (kind === "effect") {
    return { kind, ...base, effect: oneOf(o.effect, EFFECT_IDS, `${path}.effect`) };
  }
  return {
    kind,
    ...base,
    generator: oneOf(o.generator, GENERATOR_IDS, `${path}.generator`),
    blend: oneOf(o.blend, BLENDS, `${path}.blend`),
  };
}

export function parseRoute(v: unknown, path: string): Route {
  const o = obj(v, path);
  const target = obj(o.target, `${path}.target`);
  const amount = num(o.amount, `${path}.amount`);
  if (amount < -1 || amount > 1) fail(`${path}.amount`, "un número entre -1 y 1");
  return {
    id: str(o.id, `${path}.id`),
    source: oneOf(o.source, SOURCES, `${path}.source`),
    sourceIndex: num(o.sourceIndex, `${path}.sourceIndex`),
    target: {
      layerId: str(target.layerId, `${path}.target.layerId`),
      param: oneOf(target.param, ["x", "y"] as const, `${path}.target.param`),
    },
    amount,
    curve: oneOf(o.curve, CURVES, `${path}.curve`),
    mode: oneOf(o.mode, ["add", "replace"] as const, `${path}.mode`),
  };
}

function track(v: unknown, path: string): GestureTrack {
  const o = obj(v, path);
  if (o.rateHz !== 30) fail(`${path}.rateHz`, "30");
  return {
    durationMs: num(o.durationMs, `${path}.durationMs`),
    rateHz: 30,
    samples: arr(o.samples, `${path}.samples`).map((s, i) => num(s, `${path}.samples[${i}]`)),
  };
}

function scene(v: unknown, path: string): Scene {
  const o = obj(v, path);
  const media = obj(o.media, `${path}.media`);
  const crop = obj(o.crop, `${path}.crop`);
  const rect = arr(crop.rect, `${path}.crop.rect`);
  if (rect.length !== 4) fail(`${path}.crop.rect`, "4 números");
  obj(o.sources, `${path}.sources`);
  return {
    media: {
      kind: oneOf(media.kind, MEDIA_KINDS, `${path}.media.kind`),
      ...(media.file !== undefined ? { file: str(media.file, `${path}.media.file`) } : {}),
      width: num(media.width, `${path}.media.width`),
      height: num(media.height, `${path}.media.height`),
    },
    crop: {
      aspect: oneOf(crop.aspect, ASPECTS, `${path}.crop.aspect`),
      rect: rect.map((r, i) => unit(r, `${path}.crop.rect[${i}]`)) as [number, number, number, number],
    },
    paint: paint(o.paint, `${path}.paint`),
    layers: arr(o.layers, `${path}.layers`).map((l, i) => parseLayer(l, `${path}.layers[${i}]`)),
    routes: arr(o.routes, `${path}.routes`).map((r, i) => parseRoute(r, `${path}.routes[${i}]`)),
    sources: parseSources(o.sources),
    tracks: arr(o.tracks, `${path}.tracks`).map((t, i) => track(t, `${path}.tracks[${i}]`)),
    seed: num(o.seed, `${path}.seed`),
  };
}

/** Valida un proyecto de la versión actual y devuelve una copia limpia (sin campos extra). */
export function validateProject(raw: unknown): ValidationResult<Project> {
  try {
    const o = obj(raw, "proyecto");
    return {
      ok: true,
      value: {
        schemaVersion: num(o.schemaVersion, "schemaVersion"),
        id: str(o.id, "id"),
        name: str(o.name, "name"),
        createdAt: str(o.createdAt, "createdAt"),
        updatedAt: str(o.updatedAt, "updatedAt"),
        scene: scene(o.scene, "scene"),
      },
    };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message };
    throw error;
  }
}
