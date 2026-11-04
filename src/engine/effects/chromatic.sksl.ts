import { EFFECT_HEADER } from "./contract";

// Anexo A. x: desplazamiento = x · 3 % del ancho; y: ángulo = y · 360°.
export const CHROMATIC_SKSL = `${EFFECT_HEADER}
half4 main(float2 xy) {
  float a = param.y * 6.2831853;
  float2 d = float2(cos(a), sin(a)) * (param.x * 0.03 * resolution.x);
  half4 c = image.eval(xy);
  return half4(image.eval(xy + d).r, c.g, image.eval(xy - d).b, c.a);
}
`;
