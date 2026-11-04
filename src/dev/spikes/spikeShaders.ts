import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

/** Imagen de prueba procedural (cuadrícula + degradado), sin archivos. */
const SOURCE_SKSL = `
uniform float2 resolution;
uniform float time;
half4 main(float2 xy) {
  float2 uv = xy / resolution;
  float2 cell = floor(uv * float2(12.0, 16.0));
  float checker = mod(cell.x + cell.y, 2.0);
  half3 grad = half3(uv.x, uv.y, 0.5 + 0.5 * sin(time));
  return half4(mix(grad, half3(1.0 - grad), checker * 0.35), 1.0);
}
`;

/** Efecto `wave` del Anexo A (1 muestra por píxel) para apilar capas. */
const WAVE_SKSL = `
uniform shader image;
uniform float2 resolution;
uniform float2 param;
half4 main(float2 xy) {
  float off = param.x * 0.05 * resolution.y * sin(xy.y / resolution.y * mix(1.0, 20.0, param.y) * 6.2831853);
  return image.eval(float2(xy.x + off, xy.y));
}
`;

function compile(name: string, sksl: string): SkRuntimeEffect {
  const effect = Skia.RuntimeEffect.Make(sksl);
  if (!effect) {
    throw new Error(`No compiló el shader de prueba "${name}".`);
  }
  return effect;
}

export const SPIKE_SOURCE = compile("source", SOURCE_SKSL);
export const SPIKE_WAVE = compile("wave", WAVE_SKSL);
