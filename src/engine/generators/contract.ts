import { EFFECT_HEADER } from "../effects/contract";

// cabecera común de los generadores. Además del contrato de los efectos, cada generador recibe
// blend y mezcla su salida con la capa de abajo: 0 = replace, 1 = screen, 2 = multiply, 3 =
// difference; opacity (0..1) funde ese resultado con la capa de abajo. En replace al 100 % no lee
// image
export const GENERATOR_HEADER = `${EFFECT_HEADER}
uniform float blend;
uniform float opacity;
// hash de Dave Hoskins: reduce la magnitud antes de mezclar, así no pierde precisión en float de 32
// bits con coordenadas grandes o con el tiempo (el hash anterior sí la pierde)
float hash21(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
half4 blendOut(float2 xy, half3 g) {
  if (blend < 0.5 && opacity >= 0.999) { return half4(g, 1.0); }
  half4 c = image.eval(xy);
  half3 r = g;
  if (blend > 2.5) { r = abs(c.rgb - g); }
  else if (blend > 1.5) { r = c.rgb * g; }
  else if (blend > 0.5) { r = 1.0 - (1.0 - c.rgb) * (1.0 - g); }
  half a = blend < 0.5 ? 1.0 : c.a;
  return half4(mix(c.rgb, r, opacity), mix(c.a, a, opacity));
}
`;

export const GENERATOR_UNIFORM_NAMES = ["resolution", "param", "time", "seed", "blend", "opacity"] as const;
