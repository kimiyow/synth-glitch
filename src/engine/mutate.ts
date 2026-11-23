import type { EffectId, Layer, Route, RouteSettings, SourceConfig, SourceId } from "../domain/types";
import { defaultRouteSetting, DIVISIONS, LFO_SHAPES } from "../modulation/sources";
import { EFFECTS } from "./registry";

// formas de onda del LFO que se ofrecen (lo aleatorio vive en la fuente AZAR)
const WAVE_SHAPES = LFO_SHAPES.filter((s) => s !== "random");

// MUTAR y ALEATORIZAR: funciones puras con semilla (misma semilla → misma escena). No tocan la
// pintura, el medio ni el recorte; devuelven capas y rutas nuevas

// cuánto se aleja una mutación de la escena original
export type MutationLevel = "subtle" | "medium" | "strong";
export const MUTATION_AMOUNT: Record<MutationLevel, number> = { subtle: 0.15, medium: 0.35, strong: 0.7 };

// guardarraíl fotosensible: lo que genera el azar nunca pasa de 3 Hz. Los LFO libres van hasta
// 2 Hz; las divisiones de pulso se eligen según el tempo de la escena
const MAX_RANDOM_HZ = 2;
const SAFE_HZ = 2.9;
const safeDivisions = (bpm: number): readonly number[] => {
  const ok = DIVISIONS.filter((d) => d >= 1 && bpm / 60 / d <= SAFE_HZ);
  return ok.length > 0 ? ok : [8];
};

// generador pseudoaleatorio mulberry32: [0, 1)
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];
// desplazamiento simétrico de ±amount
const jitter = (r: () => number, amount: number) => (r() * 2 - 1) * amount;

function mutateSettings(s: RouteSettings, r: () => number, amount: number, divs: readonly number[]): RouteSettings {
  const out: RouteSettings = JSON.parse(JSON.stringify(s));
  if (out.lfo) {
    const l = out.lfo;
    // la velocidad varía en escala logarítmica
    l.rateHz = round(clamp(l.rateHz * Math.exp(jitter(r, amount * 1.5)), 0.05, MAX_RANDOM_HZ), 2);
    if (r() < amount * 0.5) l.shape = pick(r, WAVE_SHAPES);
    l.depth = round(clamp(l.depth + jitter(r, amount * 0.5), 0.1, 1), 2);
    l.phase = round(clamp(l.phase + jitter(r, amount), 0, 1), 2);
    if (l.sync && r() < amount * 0.5) l.division = pick(r, divs);
  }
  if (out.adsr) {
    const a = out.adsr;
    a.attack = round(clamp(a.attack * Math.exp(jitter(r, amount)), 0, 2), 2);
    a.decay = round(clamp(a.decay * Math.exp(jitter(r, amount)), 0, 2), 2);
    a.sustain = round(clamp(a.sustain + jitter(r, amount * 0.5), 0, 1), 2);
    a.release = round(clamp(a.release * Math.exp(jitter(r, amount)), 0, 2), 2);
  }
  if (out.sh) {
    if (r() < amount) out.sh.division = pick(r, divs);
    out.sh.slew = round(clamp(out.sh.slew + jitter(r, amount * 0.5), 0, 1), 2);
  }
  if (out.seq) {
    out.seq.steps = out.seq.steps.map((v) => round(clamp(v + jitter(r, amount * 0.6), 0, 1), 2));
  }
  if (out.mic) {
    out.mic.gain = round(clamp(out.mic.gain * Math.exp(jitter(r, amount)), 0.25, 4), 2);
  }
  return out;
}

// variación de la escena: parámetros X/Y de cada capa e intensidad y ajustes de cada modulación.
// No agrega ni quita capas, no cambia fuentes ni el gesto grabado
export function mutateScene(
  layers: readonly Layer[],
  routes: readonly Route[],
  seed: number,
  level: MutationLevel,
  bpm: number,
): { layers: Layer[]; routes: Route[] } {
  const amount = MUTATION_AMOUNT[level];
  const divs = safeDivisions(bpm);
  const r = rng(seed);
  const nextLayers = layers.map((l) => ({
    ...l,
    params: { x: round(clamp(l.params.x + jitter(r, amount * 0.5), 0, 1)), y: round(clamp(l.params.y + jitter(r, amount * 0.5), 0, 1)) },
  }));
  const nextRoutes = routes.map((rt) => ({
    ...rt,
    target: { ...rt.target },
    amount: round(clamp(rt.amount + jitter(r, amount * 0.4), -1, 1), 2),
    settings: rt.settings ? mutateSettings(rt.settings, r, amount, divs) : rt.settings,
  }));
  return { layers: nextLayers, routes: nextRoutes };
}

const AUTO_SOURCES: readonly SourceId[] = ["lfo", "sh", "seq", "tempo"];

// escena nueva: 2 o 3 efectos distintos con parámetros al azar y 1 o 2 modulaciones automáticas
// cada uno (LFO, AZAR, PASOS, PULSO), siempre por debajo de 3 Hz
export function randomScene(seed: number, scene: SourceConfig): { layers: Layer[]; routes: Route[] } {
  const r = rng(seed);
  const divs = safeDivisions(scene.tempo.bpm);
  // PULSO va a un tiempo por pulso: solo si el tempo queda por debajo del límite
  const sources = scene.tempo.bpm / 60 <= SAFE_HZ ? AUTO_SOURCES : AUTO_SOURCES.filter((x) => x !== "tempo");
  const pool: EffectId[] = EFFECTS.map((e) => e.id);
  const count = 2 + Math.floor(r() * 2);
  const layers: Layer[] = [];
  const routes: Route[] = [];
  const tag = seed.toString(36);
  for (let i = 0; i < count && pool.length > 0; i++) {
    const effect = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const id = `${effect}-r${tag}${i}`;
    layers.push({ kind: "effect", id, effect, params: { x: round(0.1 + r() * 0.6), y: round(0.1 + r() * 0.6) }, visible: true });
    const mods = 1 + Math.floor(r() * 2);
    for (let m = 0; m < mods; m++) {
      const source = pick(r, sources);
      const settings = defaultRouteSetting(source, scene);
      if (settings.lfo) {
        settings.lfo = { ...settings.lfo, shape: pick(r, WAVE_SHAPES), rateHz: round(0.1 + r() * (MAX_RANDOM_HZ - 0.1), 2), sync: false, phase: round(r(), 2), depth: 1 };
      }
      if (settings.sh) settings.sh = { ...settings.sh, division: pick(r, divs), slew: round(r() * 0.6, 2), sync: true };
      if (settings.seq) settings.seq = { ...settings.seq, steps: settings.seq.steps.map(() => round(r(), 2)), division: pick(r, divs) };
      routes.push({
        id: `mod-r${tag}${i}${m}`,
        source,
        sourceIndex: 0,
        target: { layerId: id, param: m === 0 ? (r() < 0.5 ? "x" : "y") : routes.at(-1)?.target.param === "x" ? "y" : "x" },
        amount: round((r() < 0.8 ? 1 : -1) * (0.2 + r() * 0.4), 2),
        curve: "lin",
        mode: source === "seq" ? "replace" : "add",
        settings,
      });
    }
  }
  return { layers, routes };
}

// semilla nueva para mostrar al usuario (4 dígitos)
export function newMutationSeed(): number {
  return 1 + Math.floor(Math.random() * 9999);
}
