import { EFFECT_HEADER } from "./contract";

// Anexo A. x: alto de franja = mix(1 %, 15 %, x); y: desplazamiento = y · 25 % del ancho.
export const DATAMOSH_SKSL = `${EFFECT_HEADER}
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
half4 main(float2 xy) {
  float h = mix(0.01, 0.15, param.x) * resolution.y;
  float strip = floor(xy.y / h);
  float off = (hash(float2(strip, 1.0)) - 0.5) * 2.0 * param.y * 0.25 * resolution.x;
  return image.eval(float2(xy.x + off, xy.y));
}
`;
