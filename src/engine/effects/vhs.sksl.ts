import { EFFECT_HEADER } from "./contract";

// Anexo A. x: jitter = x · 3 % del ancho; y: banda de tracking = y · 25 % del alto.
export const VHS_SKSL = `${EFFECT_HEADER}
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
half4 main(float2 xy) {
  float2 uv = xy / resolution;
  float line = floor(uv.y * 240.0);
  float jitter = (hash(float2(line, floor(time * 24.0))) - 0.5) * param.x * 0.03 * resolution.x;
  float band = fract(time * 0.2);
  float inBand = step(band, uv.y) * step(uv.y, band + param.y * 0.25);
  float shift = jitter + inBand * param.y * 0.08 * resolution.x;
  half4 c = image.eval(float2(xy.x + shift, xy.y));
  half r = image.eval(float2(xy.x + shift + 0.004 * resolution.x, xy.y)).r;
  return half4(r, c.g, c.b, c.a);
}
`;
