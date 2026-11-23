import { GENERATOR_HEADER } from "./contract";

// anillos concéntricos que se expanden desde cerca del centro (la semilla lo corre un poco). x:
// anillos = mix(3, 40, x); y: velocidad = mix(0, 1.5, y) anillos/s; con y = 0 quedan quietos
export const RINGS_SKSL = `${GENERATOR_HEADER}
half4 main(float2 xy) {
  float2 center = resolution * 0.5 + (float2(hash21(float2(seed, 1.0)), hash21(float2(seed, 2.0))) - 0.5) * resolution.y * 0.2;
  float r = length(xy - center) / resolution.y;
  float t = time * mix(0.0, 1.5, param.y);
  float v = 0.5 + 0.5 * sin((r * mix(3.0, 40.0, param.x) - t) * 6.2831853);
  return blendOut(xy, half3(smoothstep(0.35, 0.65, v)));
}
`;
