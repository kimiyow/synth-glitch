import type { LfoShape, SeqDirection, SourceConfig } from "../state/types";

/** Valores por defecto de las fuentes (parámetros diseñados, principio 5). */
export const DEFAULT_SOURCES: SourceConfig = {
  tempo: { bpm: 120 },
  lfo: { shape: "sine", rateHz: 0.5, sync: false, division: 4, phase: 0, depth: 1 },
  adsr: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.6 },
  sh: { division: 1, slew: 0.15 },
  seq: { steps: [1, 0, 0.5, 0, 0.75, 0, 0.25, 0], division: 0.5, direction: "forward" },
  orientation: { sensitivity: 1, deadzone: 0.04, swapAxes: false },
  mic: { floor: -50, ceiling: -10, attack: 0.02, release: 0.25, hitThreshold: 0.7 },
};

export const LFO_SHAPES: readonly LfoShape[] = ["sine", "triangle", "square", "saw", "random"];
export const SEQ_DIRECTIONS: readonly SeqDirection[] = ["forward", "backward", "pingpong", "random"];
/** Divisiones de pulso disponibles (en pulsos por ciclo o por paso). */
export const DIVISIONS = [0.25, 0.5, 1, 2, 4, 8] as const;
export const MIN_BPM = 40;
export const MAX_BPM = 220;

/** Hash entero → [0, 1). */
export function hash01(a: number, b: number): number {
  "worklet";
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ ((b | 0) + 0xc2b2ae35), 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function num(v: unknown, def: number, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}
function pick<T extends string>(v: unknown, options: readonly T[], def: T): T {
  return options.includes(v as T) ? (v as T) : def;
}
function o(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

/** Lee `sources` de un proyecto: lo ausente o inválido toma el valor por defecto (proyectos de M2-M6 traen `{}`). */
export function parseSources(raw: unknown): SourceConfig {
  const r = o(raw);
  const d = DEFAULT_SOURCES;
  const lfo = o(r.lfo), adsr = o(r.adsr), sh = o(r.sh), seq = o(r.seq), ori = o(r.orientation), mic = o(r.mic);
  const steps = Array.isArray(seq.steps) && (seq.steps.length === 8 || seq.steps.length === 16)
    ? seq.steps.map((s) => num(s, 0, 0, 1))
    : [...d.seq.steps];
  return {
    tempo: { bpm: num(o(r.tempo).bpm, d.tempo.bpm, MIN_BPM, MAX_BPM) },
    lfo: {
      shape: pick(lfo.shape, LFO_SHAPES, d.lfo.shape),
      rateHz: num(lfo.rateHz, d.lfo.rateHz, 0.01, 20),
      sync: typeof lfo.sync === "boolean" ? lfo.sync : d.lfo.sync,
      division: num(lfo.division, d.lfo.division, 0.25, 64),
      phase: num(lfo.phase, d.lfo.phase, 0, 1),
      depth: num(lfo.depth, d.lfo.depth, 0, 1),
    },
    adsr: {
      attack: num(adsr.attack, d.adsr.attack, 0, 10),
      decay: num(adsr.decay, d.adsr.decay, 0, 10),
      sustain: num(adsr.sustain, d.adsr.sustain, 0, 1),
      release: num(adsr.release, d.adsr.release, 0, 10),
    },
    sh: { division: num(sh.division, d.sh.division, 0.25, 64), slew: num(sh.slew, d.sh.slew, 0, 1) },
    seq: { steps, division: num(seq.division, d.seq.division, 0.25, 64), direction: pick(seq.direction, SEQ_DIRECTIONS, d.seq.direction) },
    orientation: {
      sensitivity: num(ori.sensitivity, d.orientation.sensitivity, 0.1, 4),
      deadzone: num(ori.deadzone, d.orientation.deadzone, 0, 0.5),
      swapAxes: typeof ori.swapAxes === "boolean" ? ori.swapAxes : d.orientation.swapAxes,
    },
    mic: {
      floor: num(mic.floor, d.mic.floor, -120, 0),
      ceiling: num(mic.ceiling, d.mic.ceiling, -120, 0),
      attack: num(mic.attack, d.mic.attack, 0, 2),
      release: num(mic.release, d.mic.release, 0, 5),
      hitThreshold: num(mic.hitThreshold, d.mic.hitThreshold, 0, 1),
    },
  };
}

/** Frecuencia efectiva en Hz: libre o sincronizada al tempo (`division` pulsos por ciclo). */
export function cycleHz(rateHz: number, sync: boolean, division: number, bpm: number): number {
  "worklet";
  return sync ? bpm / 60 / division : rateHz;
}

/** LFO bipolar (-1..1) × profundidad. */
export function lfoValue(cfg: SourceConfig["lfo"], bpm: number, t: number, seed: number): number {
  "worklet";
  const phase = t * cycleHz(cfg.rateHz, cfg.sync, cfg.division, bpm) + cfg.phase;
  const f = phase - Math.floor(phase);
  let v: number;
  if (cfg.shape === "sine") v = Math.sin(f * 2 * Math.PI);
  else if (cfg.shape === "triangle") v = 1 - 4 * Math.abs(f - 0.5);
  else if (cfg.shape === "square") v = f < 0.5 ? 1 : -1;
  else if (cfg.shape === "saw") v = 2 * f - 1;
  else v = hash01(seed, Math.floor(phase)) * 2 - 1; // aleatoria: nuevo valor por ciclo
  return v * cfg.depth;
}

/**
 * ADSR (0..1) a partir del momento en que se apoyó (`onAt`) y se levantó (`offAt`) el dedo.
 * Puro: el valor depende solo del tiempo y de esos dos instantes.
 */
export function adsrValue(cfg: SourceConfig["adsr"], t: number, onAt: number | null, offAt: number | null): number {
  "worklet";
  if (onAt === null || t < onAt) return 0;
  const held = (until: number) => {
    const e = until - onAt;
    if (e < cfg.attack) return cfg.attack > 0 ? e / cfg.attack : 1;
    const d = e - cfg.attack;
    if (d < cfg.decay) return 1 - (1 - cfg.sustain) * (cfg.decay > 0 ? d / cfg.decay : 1);
    return cfg.sustain;
  };
  if (offAt === null || offAt < onAt || t < offAt) return held(t);
  const level = held(offAt);
  const r = t - offAt;
  return r >= cfg.release ? 0 : level * (1 - r / Math.max(cfg.release, 1e-6));
}

/** Sample & hold bipolar: nuevo valor de ruido en cada pulso, con deslizamiento (`slew` = fracción del paso). */
export function shValue(cfg: SourceConfig["sh"], bpm: number, t: number, seed: number): number {
  "worklet";
  const stepLen = (60 / bpm) * cfg.division;
  const k = Math.floor(t / stepLen);
  const cur = hash01(seed + 17, k) * 2 - 1;
  const prev = hash01(seed + 17, k - 1) * 2 - 1;
  const into = (t - k * stepLen) / stepLen;
  const a = cfg.slew > 0 ? Math.min(1, into / cfg.slew) : 1;
  return prev + (cur - prev) * a;
}

/** Índice del paso actual del secuenciador. */
export function seqIndex(cfg: SourceConfig["seq"], bpm: number, t: number, seed: number): number {
  "worklet";
  const n = cfg.steps.length;
  const k = Math.max(0, Math.floor(t / ((60 / bpm) * cfg.division)));
  if (cfg.direction === "forward") return k % n;
  if (cfg.direction === "backward") return n - 1 - (k % n);
  if (cfg.direction === "pingpong") {
    const period = 2 * n - 2;
    const p = k % period;
    return p < n ? p : period - p;
  }
  return Math.floor(hash01(seed + 31, k) * n);
}

export function seqValue(cfg: SourceConfig["seq"], bpm: number, t: number, seed: number): number {
  "worklet";
  return cfg.steps[seqIndex(cfg, bpm, t, seed)] ?? 0;
}
