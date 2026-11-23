import { GENERATOR_HEADER } from "./contract";

// tablero con glitch. x: casillas a lo alto = mix(4, 48, x); y: parpadeo = mix(0.5, 3, y) cambios/s.
// En cada cambio ~1 de cada 4 franjas (de dos filas) se corre de lado y ~15 % de las casillas se
// invierte; con y = 0 queda quieto. El tope de 3 cambios/s y las fracciones pequeñas lo dejan bajo el
// umbral de destellos (modulation/safety.ts)
export const CHECKER_SKSL = `${GENERATOR_HEADER}
half4 main(float2 xy) {
  float cell = resolution.y / mix(4.0, 48.0, param.x);
  float on = param.y > 0.0 ? 1.0 : 0.0;
  float tick = on * floor(time * mix(0.5, 3.0, param.y));
  float band = floor(xy.y / cell * 0.5);
  float shift = on * step(0.75, hash21(float2(band, tick) + seed)) * (hash21(float2(band, tick + 7.0) + seed) - 0.5) * 6.0;
  float2 c = floor(float2(xy.x / cell + shift, xy.y / cell));
  float base = mod(c.x + c.y, 2.0);
  float flip = on * step(0.85, hash21(c + seed + tick * 13.1));
  return blendOut(xy, half3(abs(base - flip)));
}
`;
