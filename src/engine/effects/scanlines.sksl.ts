import { EFFECT_HEADER } from "./contract";

// Anexo A. x: líneas = mix(80, 400, x); y: ruido = y · 0.35.
export const SCANLINES_SKSL = `${EFFECT_HEADER}
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
half4 main(float2 xy) {
  float2 uv = xy / resolution;
  half4 c = image.eval(xy);
  float s = 0.5 + 0.5 * sin(uv.y * mix(80.0, 400.0, param.x) * 6.2831853);
  float n = hash(floor(uv * 720.0) + floor(time * 30.0)) - 0.5;
  half3 rgb = c.rgb * half(mix(1.0, 0.55, s)) + half(n * param.y * 0.35);
  return half4(saturate(rgb), c.a);
}
`;
