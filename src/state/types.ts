/**
 * Contratos de datos del SDD v2, sección 6.1. Son la fuente de verdad:
 * no se cambian sin actualizar el SDD. Este archivo no importa nada.
 */

export type EffectId = "chromatic" | "scanlines" | "datamosh" | "vhs" | "pixelate" | "wave" | "crt";
export type GeneratorId = "noise" | "bars" | "voronoi";
export type StampEffect = "datamosh" | "chromatic" | "pixel" | "smear";

/** x, y, size normalizados al ancho de la imagen. */
export type Stamp = {
  x: number;
  y: number;
  size: number;
  effect: StampEffect;
  erase: boolean;
  params: number[];
  seed: number;
};
export type Stroke = { id: string; stamps: Stamp[]; strokeSeed: number };
/** Máximo 400 trazos. */
export type PaintLayer = { strokes: Stroke[] };

export type BlendMode = "replace" | "screen" | "multiply" | "difference";

export type EffectLayer = {
  kind: "effect";
  id: string;
  effect: EffectId;
  params: { x: number; y: number };
  visible: boolean;
};
export type GeneratorLayer = {
  kind: "generator";
  id: string;
  generator: GeneratorId;
  params: { x: number; y: number };
  visible: boolean;
  blend: BlendMode;
};
export type Layer = EffectLayer | GeneratorLayer;

export type SourceId = "touch" | "lfo" | "adsr" | "sh" | "seq" | "orientation" | "mic" | "track" | "tempo";
export type RouteCurve = "lin" | "exp" | "log" | "scurve";
export type Route = {
  id: string;
  source: SourceId;
  sourceIndex: number;
  target: { layerId: string; param: "x" | "y" };
  amount: number;
  curve: RouteCurve;
  mode: "add" | "replace";
};

/**
 * Parámetros de LFO, ADSR, S&H, SEQ, tempo, mic y orientación.
 * El SDD no fija su forma todavía; se define en M7.
 */
export type SourceConfig = Record<string, never>;

/** Pares [x, y] intercalados. */
export type GestureTrack = { durationMs: number; rateHz: 30; samples: number[] };

export type CropAspect = "9:16" | "1:1" | "4:5" | "free";

export type Scene = {
  media: { kind: "photo" | "clip" | "generative"; file?: string; width: number; height: number };
  /** rect normalizado [x, y, ancho, alto]. */
  crop: { aspect: CropAspect; rect: [number, number, number, number] };
  paint: PaintLayer;
  layers: Layer[];
  routes: Route[];
  sources: SourceConfig;
  tracks: GestureTrack[];
  seed: number;
};

export type Project = {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  scene: Scene;
};

export type ScenePreset = {
  id: string;
  name: string;
  builtIn: boolean;
  layers: Layer[];
  routes: Route[];
  sources: SourceConfig;
};

/** Receta compartible: sin pintura ni SkSL propio (ADR-12). */
export type SynthFx = {
  synthfx: 1;
  name: string;
  layers: Layer[];
  routes: Route[];
  sources: SourceConfig;
  seed: number;
};
