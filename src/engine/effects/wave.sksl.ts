import { EFFECT_HEADER } from "./contract";

// Anexo A. x: amplitud = x · 5 % del alto; y: ondas = mix(1, 20, y).
export const WAVE_SKSL = `${EFFECT_HEADER}
half4 main(float2 xy) {
  float off = param.x * 0.05 * resolution.y * sin(xy.y / resolution.y * mix(1.0, 20.0, param.y) * 6.2831853);
  return image.eval(float2(xy.x + off, xy.y));
}
`;
