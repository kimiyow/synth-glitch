import { EFFECT_HEADER } from "./contract";

// pixel sorting aproximado en un pase: la columna se parte en tramos y cada píxel toma el color
// que le toca por rango de luminancia entre 8 muestras del tramo (ordenado de oscuro a claro).
// x: largo del tramo = mix(3 %, 45 %) del alto; y: umbral = y · 0.9 (los píxeles más oscuros no se ordenan).
// Las columnas se cuentan en 360 franjas normalizadas para que preview y exportación coincidan
export const PIXELSORT_SKSL = `${EFFECT_HEADER}
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
float luma(half3 c) { return dot(float3(c), float3(0.299, 0.587, 0.114)); }
half4 main(float2 xy) {
  half4 here = image.eval(xy);
  float thr = param.y * 0.9;
  if (luma(here.rgb) < thr) return here;
  float span = max(mix(0.03, 0.45, param.x) * resolution.y, 2.0);
  float col = floor(xy.x / resolution.x * 360.0);
  float jit = hash(float2(col, seed + 1.0)) * span;
  float start = floor((xy.y + jit) / span) * span - jit;
  float t = clamp((xy.y - start) / span, 0.0, 1.0);
  half4 c[8];
  float l[8];
  for (int i = 0; i < 8; i++) {
    float sy = clamp(start + (float(i) + 0.5) / 8.0 * span, 0.0, resolution.y - 1.0);
    c[i] = image.eval(float2(xy.x, sy));
    l[i] = luma(c[i].rgb);
  }
  float r = t * 7.0;
  float r0 = floor(r);
  float r1 = min(r0 + 1.0, 7.0);
  half4 a = here;
  half4 b = here;
  for (int i = 0; i < 8; i++) {
    float rank = 0.0;
    for (int j = 0; j < 8; j++) {
      if (l[j] < l[i] || (l[j] == l[i] && j < i)) rank += 1.0;
    }
    if (rank == r0) a = c[i];
    if (rank == r1) b = c[i];
  }
  return mix(a, b, half(r - r0));
}
`;
