import { Skia, type SkImage } from "@shopify/react-native-skia";
import { useState } from "react";

/**
 * Imagen de prueba determinista, sin archivos: degradado, cuadrícula, círculos
 * concéntricos y barras de color (útiles para ver chromatic, pixel y crt).
 */
const TEST_IMAGE_SKSL = `
uniform float2 resolution;
half4 main(float2 xy) {
  float2 uv = xy / resolution;
  half3 col = half3(uv.x, 0.35 + 0.4 * uv.y, 1.0 - uv.x);
  float2 cell = floor(uv * float2(8.0, 10.0));
  col *= half(mod(cell.x + cell.y, 2.0) * 0.25 + 0.75);
  float r = length((uv - 0.5) * float2(resolution.x / resolution.y, 1.0));
  col = mix(col, half3(1.0), half(step(0.5, fract(r * 10.0)) * step(r, 0.3) * 0.8));
  if (uv.y > 0.85) {
    float bar = floor(uv.x * 7.0);
    col = half3(mod(bar, 2.0), mod(floor(bar / 2.0), 2.0), mod(floor(bar / 4.0), 2.0));
  }
  return half4(col, 1.0);
}
`;

/** 3:4 vertical, como el lienzo del laboratorio. */
export const TEST_IMAGE_SIZE = { width: 1080, height: 1440 };

let cached: SkImage | null = null;

export function makeTestImage(): SkImage | null {
  if (cached) return cached;
  const { width, height } = TEST_IMAGE_SIZE;
  const effect = Skia.RuntimeEffect.Make(TEST_IMAGE_SKSL);
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!effect || !surface) return null;
  const paint = Skia.Paint();
  paint.setShader(effect.makeShader([width, height]));
  surface.getCanvas().drawPaint(paint);
  surface.flush();
  cached = surface.makeImageSnapshot().makeNonTextureImage();
  return cached;
}

export function useTestImage(): SkImage | null {
  const [image] = useState<SkImage | null>(makeTestImage);
  return image;
}
