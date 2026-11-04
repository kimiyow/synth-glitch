import { EFFECT_HEADER } from "../effects/contract";

/**
 * Cabecera común de los generadores (SDD 6.2 y GEN-02). Además del contrato de los
 * efectos, cada generador recibe `blend` y mezcla su salida con la capa de abajo:
 * 0 = replace, 1 = screen, 2 = multiply, 3 = difference. En `replace` no lee `image`.
 */
export const GENERATOR_HEADER = `${EFFECT_HEADER}
uniform float blend;
// Hash de Dave Hoskins: reduce la magnitud antes de mezclar, así no pierde precisión en
// float de 32 bits con coordenadas grandes o con el tiempo (el del Anexo 6.5 sí la pierde).
float hash21(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
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
