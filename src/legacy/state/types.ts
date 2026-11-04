import type { EffectId } from "../effects/registry";

export type LfoShape = "sine" | "triangle" | "square" | "random";

export type LfoConfig = {
  enabled: boolean;
  shape: LfoShape;
  rateHz: number;
  depth: number;
};

export type Layer = {
  id: string;
  effect: EffectId;
  params: { x: number; y: number };
  lfoX: LfoConfig;
  lfoY: LfoConfig;
  visible: boolean;
};

export type GestureTrack = {
  durationMs: number;
  sampleRateHz: 30;
  layerIds: string[];
  samples: number[];
};

export type SceneConfig = {
  layers: Layer[];
  gyroOnY: boolean;
  track: GestureTrack | null;
};

export type UndoEntry = {
  label: string;
  before: SceneConfig;
  after: SceneConfig;
};

export type UndoState = {
  past: UndoEntry[];
  future: UndoEntry[];
};
