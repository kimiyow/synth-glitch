import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

import type { EffectId, GeneratorId } from "../state/types";
import { EFFECT_BY_ID, GENERATOR_BY_ID } from "./registry";

const cache = new Map<string, SkRuntimeEffect | null>();

function compile(key: string, sksl: string, what: string): SkRuntimeEffect | null {
  if (!cache.has(key)) {
    const effect = Skia.RuntimeEffect.Make(sksl);
    if (!effect) {
      console.error(`No compiló el shader ${what}.`);
    }
    cache.set(key, effect);
  }
  return cache.get(key) ?? null;
}

/** Compila (una sola vez) el shader de un efecto; `null` si el SkSL no compila. */
export function getEffectRuntime(id: EffectId): SkRuntimeEffect | null {
  return compile(`fx:${id}`, EFFECT_BY_ID[id].sksl, `del efecto "${id}"`);
}

/** Compila (una sola vez) el shader de un generador; `null` si el SkSL no compila. */
export function getGeneratorRuntime(id: GeneratorId): SkRuntimeEffect | null {
  return compile(`gen:${id}`, GENERATOR_BY_ID[id].sksl, `del generador "${id}"`);
}
