import { GENERATOR_HEADER } from "./contract";

// túnel de anillos (profundidad = 1 / distancia, como "Psychedelic Tunnel" de Skia Labs): más juntos
// hacia el centro, cortados en segmentos como datos, que avanzan hacia la cámara. La semilla corre un
// poco el centro. x: anillos = mix(1, 8, x); y: velocidad = mix(0, 2, y); con y = 0 quedan quietos.
// Donde caben demasiados anillos por píxel (el centro) se apagan para que no haya moiré
export const RINGS_SKSL = `${GENERATOR_HEADER}
half4 main(float2 xy) {
  float2 center = resolution * 0.5 + (float2(hash21(float2(seed, 1.0)), hash21(float2(seed, 2.0))) - 0.5) * resolution.y * 0.2;
  float2 p = (xy - center) / resolution.y;
  float r = length(p) + 0.02;
  float k = mix(1.0, 8.0, param.x);
  // + time: cada anillo crece hacia afuera (sale del túnel hacia la cámara)
  float depth = (0.3 / r + time * mix(0.0, 2.0, param.y)) * k;
  float ring = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(depth * 6.2831853));
  float seg = step(0.3, hash21(float2(floor(depth), floor((atan(p.y, p.x) + 3.1415927) / 6.2831853 * 24.0)) + seed));
  float perPixel = k * 0.3 / (r * r) / resolution.y;
  float aa = 1.0 - smoothstep(0.15, 0.4, perPixel);
  return blendOut(xy, half3(ring * seg * aa));
}
`;
