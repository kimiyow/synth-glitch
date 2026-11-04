import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

import type { EffectId } from "../state/types";
import { EFFECT_BY_ID } from "./registry";

const cache = new Map<EffectId, SkRuntimeEffect | null>();

/** Compila (una sola vez) el shader de un efecto; `null` si el SkSL no compila. */
export function getEffectRuntime(id: EffectId): SkRuntimeEffect | null {
  if (!cache.has(id)) {
    const effect = Skia.RuntimeEffect.Make(EFFECT_BY_ID[id].sksl);
    if (!effect) {
      console.error(`No compiló el shader del efecto "${id}".`);
    }
    cache.set(id, effect);
  }
  return cache.get(id) ?? null;
}
