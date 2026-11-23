// tipos de datos que comparte toda la app. Este archivo no importa nada

export type EffectId = "chromatic" | "scanlines" | "datamosh" | "vhs" | "pixelate" | "wave" | "crt" | "pixelsort" | "databend";
export type GeneratorId = "noise" | "bars" | "voronoi" | "grid" | "checker" | "rings";
export type StampEffect = "datamosh" | "chromatic" | "pixel" | "smear";

// x, y, size normalizados al ancho de la imagen
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
// máximo 400 trazos. Es la fila PINTURA de Capas: index = cuántas capas quedan debajo (0 = sobre la
// imagen); visible = el ojo de la fila
export type PaintLayer = { strokes: Stroke[]; visible: boolean; index: number };

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
  // semilla propia de la capa (0-999), sumada a la del proyecto. Es opcional
  seed?: number;
};
export type Layer = EffectLayer | GeneratorLayer;

export type SourceId = "touch" | "lfo" | "adsr" | "sh" | "seq" | "mic" | "track" | "tempo";
export type RouteCurve = "lin" | "exp" | "log" | "scurve";
export type Route = {
  id: string;
  source: SourceId;
  sourceIndex: number;
  target: { layerId: string; param: "x" | "y" };
  amount: number;
  curve: RouteCurve;
  mode: "add" | "replace";
  // ajustes propios de esta modulación, uno por tipo de fuente (se conservan al cambiar de fuente).
  // Sin ellos se usan los de la escena (proyectos anteriores)
  settings?: RouteSettings;
};

// micrófono por modulación: la entrada y su calibración son de la escena; cada ruta decide cómo
// responde. level = sigue el volumen; hit = pulso que decae en cada golpe
export type MicRouteConfig = { mode: "level" | "hit"; gain: number; decay: number };
export type AdsrTrigger = "touch" | "mic";
// gesto grabado: posición absoluta del dedo [x, y] intercalada (0..1) a 30 Hz. smooth = el final se
// funde con el inicio para que el bucle no salte; cut = salta tal cual se grabó
export type GestureLoop = "smooth" | "cut";
export type GestureDirection = "forward" | "reverse" | "pingpong";
// transformaciones de reproducción (opcionales: sin ellas, 1×, adelante y sin espejo). Se aplican al
// reproducir; las muestras grabadas no cambian
export type GestureClip = {
  durationMs: number;
  samples: number[];
  loop: GestureLoop;
  speed?: number;
  direction?: GestureDirection;
  mirrorX?: boolean;
  mirrorY?: boolean;
};
// gesto guardado en la biblioteca de la app (se aplica a cualquier capa o proyecto)
export type GesturePreset = { id: string; name: string; durationMs: number; samples: number[] };

export type RouteSettings = {
  gesture?: GestureClip;
  lfo?: SourceConfig["lfo"];
  adsr?: SourceConfig["adsr"] & { trigger: AdsrTrigger };
  sh?: SourceConfig["sh"];
  seq?: SourceConfig["seq"];
  mic?: MicRouteConfig;
};

// configuración de las fuentes. Una instancia de cada tipo por escena (sourceIndex = 0). Divisiones
// en pulsos (beats)
export type LfoShape = "sine" | "triangle" | "square" | "saw" | "random";
export type SeqDirection = "forward" | "backward" | "pingpong" | "random";
export type SourceConfig = {
  tempo: { bpm: number };
  lfo: { shape: LfoShape; rateHz: number; sync: boolean; division: number; phase: number; depth: number };
  adsr: { attack: number; decay: number; sustain: number; release: number };
  // sync = cambia en cada división del reloj; libre = rateHz cambios por segundo
  sh: { division: number; slew: number; sync: boolean; rateHz: number };
  seq: { steps: number[]; division: number; direction: SeqDirection };
  mic: { floor: number; ceiling: number; attack: number; release: number; hitThreshold: number };
};

// pares [x, y] intercalados
export type GestureTrack = { durationMs: number; rateHz: 30; samples: number[] };

export type CropAspect = "9:16" | "1:1" | "4:5" | "free";

export type Scene = {
  media: { kind: "photo" | "clip" | "generative"; file?: string; width: number; height: number };
  // rect normalizado [x, y, ancho, alto]
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

// receta compartible: sin pintura ni SkSL propio
export type SynthFx = {
  synthfx: 1;
  name: string;
  layers: Layer[];
  routes: Route[];
  sources: SourceConfig;
  seed: number;
};
