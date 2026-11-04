import { GENERATOR_HEADER } from "./contract";

// 6.4 y 6.5. x: escala = mix(2, 40, x); y: velocidad de evolución = mix(0, 1.5, y).
export const NOISE_SKSL = `${GENERATOR_HEADER}
float vnoise(float2 p) {
  float2 i = floor(p); float2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + float2(1.0, 0.0)), f.x),
             mix(hash21(i + float2(0.0, 1.0)), hash21(i + float2(1.0, 1.0)), f.x), f.y);
}
half4 main(float2 xy) {
  float2 p = xy / resolution.y * mix(2.0, 40.0, param.x) + seed * 1.7;
  float t = time * mix(0.0, 1.5, param.y);
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p + t); p *= 2.0; a *= 0.5; }
  return blendOut(xy, half3(v));
}
`;
