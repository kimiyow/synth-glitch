import { GENERATOR_HEADER } from "./contract";

// estilo Ikeda. x: densidad = mix(24, 400, x); y: renovación = mix(4, 24, y) ciclos/s, y con y = 0
// queda quieto, como ruido y voronoi (el movimiento lo pone una modulación)
export const BARS_SKSL = `${GENERATOR_HEADER}
half4 main(float2 xy) {
  float cols = mix(24.0, 400.0, param.x);
  float x = floor(xy.x / resolution.x * cols);
  float tick = param.y <= 0.0 ? 0.0 : floor(time * mix(4.0, 24.0, param.y));
  return blendOut(xy, half3(step(0.5, hash21(float2(x, tick) + seed))));
}
`;
