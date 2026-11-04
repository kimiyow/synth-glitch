import type { StampEffect } from "../../state/types";

/**
 * Shaders de sello (6.2, 6.5). Cada sello lee del buffer acumulado (`image`) y solo se
 * dibuja dentro de `rect` (px: x0, y0, x1, y1). `sp` son los parámetros del efecto.
 * Todo desplazamiento es fracción del lado del sello (ADR-14). BORRAR no usa shader:
 * dibuja el original dentro del cuadrado.
 */
const HEADER = `
uniform shader image;
uniform float4 rect;
uniform float seed;
uniform float2 sp;
float hash21(float2 p){ p = fract(p * float2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`;

export const STAMP_SKSL: Record<StampEffect, string> = {
  // sp: franjas, amplitud
  datamosh: `${HEADER}
half4 main(float2 xy){
  float2 sz = rect.zw - rect.xy;
  float band = floor((xy.y - rect.y) / sz.y * sp.x);
  float off = (hash21(float2(band, seed)) - 0.5) * 2.0 * sp.y * sz.x;
  return image.eval(float2(xy.x + off, xy.y));
}`,
  // sp.x: amplitud; ángulo derivado de la semilla
  chromatic: `${HEADER}
half4 main(float2 xy){
  float a = hash21(float2(seed, 3.0)) * 6.2831853;
  float2 d = float2(cos(a), sin(a)) * sp.x * (rect.z - rect.x);
  half4 c = image.eval(xy);
  return half4(image.eval(xy + d).r, c.g, image.eval(xy - d).b, c.a);
}`,
  // sp.x: celdas por lado
  pixel: `${HEADER}
half4 main(float2 xy){
  float cell = (rect.z - rect.x) / max(sp.x, 1.0);
  return image.eval(rect.xy + (floor((xy - rect.xy) / cell) + 0.5) * cell);
}`,
  // sp.x: longitud; arrastra la columna izquierda a lo ancho del cuadrado
  smear: `${HEADER}
half4 main(float2 xy){
  float x = mix(xy.x, rect.x + 0.5, clamp(sp.x, 0.0, 1.0));
  return image.eval(float2(x, xy.y));
}`,
};

export const STAMP_UNIFORMS = ["rect", "seed", "sp"] as const;
