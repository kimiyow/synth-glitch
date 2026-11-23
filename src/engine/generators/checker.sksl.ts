import { GENERATOR_HEADER } from "./contract";

// tablero de casillas blancas y negras. x: casillas a lo alto = mix(4, 48, x); y: parpadeo = mix(0.5,
// 3, y) cambios/s en los que ~1 de cada 5 casillas se invierte; con y = 0 queda quieto. El tope de
// 3 cambios/s y la fracción pequeña lo dejan bajo el umbral de destellos (modulation/safety.ts)
export const CHECKER_SKSL = `${GENERATOR_HEADER}
half4 main(float2 xy) {
  float2 c = floor(xy / resolution.y * mix(4.0, 48.0, param.x));
  float base = mod(c.x + c.y, 2.0);
  float tick = param.y <= 0.0 ? 0.0 : floor(time * mix(0.5, 3.0, param.y));
  float flip = param.y <= 0.0 ? 0.0 : step(0.8, hash21(c + seed + tick * 13.1));
  return blendOut(xy, half3(abs(base - flip)));
}
`;
