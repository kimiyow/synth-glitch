import { EFFECT_HEADER } from "./contract";

// Anexo A. x: bloque = mix(0.5 %, 6 %, x) del ancho; y: niveles = mix(32, 3, y).
export const PIXELATE_SKSL = `${EFFECT_HEADER}
half4 main(float2 xy) {
  float block = max(mix(0.005, 0.06, param.x) * resolution.x, 1.0);
  half4 c = image.eval((floor(xy / block) + 0.5) * block);
  half levels = half(mix(32.0, 3.0, param.y));
  return half4(floor(c.rgb * levels + 0.5) / levels, c.a);
}
`;
