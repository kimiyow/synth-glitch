import { GENERATOR_HEADER } from "./contract";

// horizonte retro: piso y techo en perspectiva que avanzan hacia la cámara, con un brillo en el
// horizonte. x: densidad = mix(2, 16, x) celdas; y: avance = mix(0, 3, y); con y = 0 queda quieto (el
// movimiento lo pone una modulación). El ancho de las líneas se calcula en píxeles a partir de cuánto
// cambia la cuadrícula por píxel (sin fwidth en SkSL): ~1 px a cualquier distancia, y lo más lejano
// se desvanece para que no aparezca moiré
export const GRID_SKSL = `${GENERATOR_HEADER}
half4 main(float2 xy) {
  float2 p = (xy - resolution * 0.5) / resolution.y;
  float ay = max(abs(p.y), 0.001);
  float k = mix(2.0, 16.0, param.x) * 0.25;
  float z = 0.25 / ay;
  float2 g = float2(p.x * z, z + time * mix(0.0, 3.0, param.y)) * k + seed * 0.37;
  // cambio de la cuadrícula por píxel en cada eje
  float dgx = z * k / resolution.y;
  float dgy = 0.25 / (ay * ay) * k / resolution.y;
  float2 f = 0.5 - abs(fract(g) - 0.5);
  float lx = 1.0 - smoothstep(0.5, 1.5, f.x / dgx);
  float ly = 1.0 - smoothstep(0.5, 1.5, f.y / dgy);
  float v = max(lx, ly) * smoothstep(0.0, 0.12, ay) + exp(-ay * 25.0) * 0.5;
  return blendOut(xy, half3(saturate(v)));
}
`;
