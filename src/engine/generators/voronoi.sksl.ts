import { GENERATOR_HEADER } from "./contract";

// 6.4. x: celdas = mix(4, 40, x) a lo alto; y: velocidad de movimiento = mix(0, 2, y).
// Distancia al punto más cercano (F1), normalizada por celda.
export const VORONOI_SKSL = `${GENERATOR_HEADER}
half4 main(float2 xy) {
  float2 p = xy / resolution.y * mix(4.0, 40.0, param.x);
  float2 cell = floor(p);
  float t = time * mix(0.0, 2.0, param.y);
  float d = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      float2 c = cell + float2(float(i), float(j));
      float hx = hash21(c + seed);
      float hy = hash21(c + seed + 71.0);
      float2 o = 0.5 + 0.45 * sin(t + 6.2831853 * float2(hx, hy));
      d = min(d, length(c + o - p));
    }
  }
  return blendOut(xy, half3(saturate(d)));
}
`;
