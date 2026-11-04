import { EFFECT_HEADER } from "../effects/contract";

/**
 * Cabecera común de los generadores (SDD 6.2 y GEN-02). Además del contrato de los
 * efectos, cada generador recibe `blend` y mezcla su salida con la capa de abajo:
 * 0 = replace, 1 = screen, 2 = multiply, 3 = difference. En `replace` no lee `image`.
 */
export const GENERATOR_HEADER = `${EFFECT_HEADER}
uniform float blend;
float hash21(float2 p) { p = fract(p * float2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
half4 blendOut(float2 xy, half3 g) {
  if (blend < 0.5) { return half4(g, 1.0); }
  half4 c = image.eval(xy);
  half3 r = abs(c.rgb - g);
  if (blend < 1.5) { r = 1.0 - (1.0 - c.rgb) * (1.0 - g); }
  else if (blend < 2.5) { r = c.rgb * g; }
  return half4(r, c.a);
}
`;

export const GENERATOR_UNIFORM_NAMES = ["resolution", "param", "time", "seed", "blend"] as const;
