import { GENERATOR_HEADER } from "./contract";

// cuadrícula de líneas finas. x: celdas a lo alto = mix(4, 60, x); y: desplazamiento en diagonal =
// mix(0, 2, y) celdas/s; con y = 0 queda quieta (el movimiento lo pone una modulación). Las líneas
// miden ~1.5 px a cualquier densidad
export const GRID_SKSL = `${GENERATOR_HEADER}
half4 main(float2 xy) {
  float cellPx = resolution.y / mix(4.0, 60.0, param.x);
  float t = time * mix(0.0, 2.0, param.y);
  float2 f = fract(xy / cellPx + float2(t, t * 0.5) + seed * 0.37);
  float w = max(1.5 / cellPx, 0.02);
  return blendOut(xy, half3(max(step(f.x, w), step(f.y, w))));
}
`;
