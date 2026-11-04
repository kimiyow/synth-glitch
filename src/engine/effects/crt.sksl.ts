import { EFFECT_HEADER } from "./contract";

/**
 * Nuevo en M1 (SDD 6.3). x: curvatura de barril = x · 12 %;
 * y: intensidad de máscara de sombra y líneas. Viñeta suave fija.
 * 2 muestras por píxel (imagen + rojo desconvergido). Todo en fracciones.
 */
export const CRT_SKSL = `${EFFECT_HEADER}
half4 main(float2 xy) {
  float2 uv = xy / resolution;
  float2 c = uv * 2.0 - 1.0;
  c *= 1.0 + param.x * 0.12 * dot(c, c);
  float2 duv = c * 0.5 + 0.5;
  if (duv.x < 0.0 || duv.x > 1.0 || duv.y < 0.0 || duv.y > 1.0) {
    return half4(0.0, 0.0, 0.0, 1.0);
  }
  float2 p = duv * resolution;
  half4 col = image.eval(p);
  col.r = image.eval(p + float2(0.0015 * resolution.x, 0.0)).r;

  float triad = mod(floor(duv.x * 960.0), 3.0);
  half3 mask = half3(triad == 0.0 ? 1.0 : 0.7, triad == 1.0 ? 1.0 : 0.7, triad == 2.0 ? 1.0 : 0.7);
  half scan = half(0.75 + 0.25 * sin(duv.y * 240.0 * 6.2831853));
  half m = half(param.y);
  half3 rgb = col.rgb * mix(half3(1.0), mask * scan, m);

  half vig = half(mix(1.0, smoothstep(1.6, 0.6, length(c)), 0.6));
  return half4(rgb * vig, col.a);
}
`;
