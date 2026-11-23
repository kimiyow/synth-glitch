// cabecera común de los efectos globales. Todos declaran el contrato completo aunque no usen cada
// uniform, para que el render graph los trate igual
export const EFFECT_HEADER = `
uniform shader image;
uniform float2 resolution;
uniform float2 param;
uniform float time;
uniform float seed;
`;

export const UNIFORM_NAMES = ["resolution", "param", "time", "seed", "blend"] as const;

// modo de mezcla de las capas de efecto (FX-06): la main de cada efecto pasa a llamarse effectMain
// y una main nueva mezcla su resultado con la capa de abajo, en el mismo píxel (una lectura más de
// image). blend: 0 = normal (el efecto reemplaza), 1 = screen, 2 = multiply, 3 = difference, igual
// que los generadores
export function withEffectBlend(sksl: string): string {
  return `${sksl.replace("half4 main(float2 xy)", "half4 effectMain(float2 xy)")}
uniform float blend;
half4 main(float2 xy) {
  half4 c = effectMain(xy);
  if (blend < 0.5) { return c; }
  half4 b = image.eval(xy);
  half3 r = abs(b.rgb - c.rgb);
  if (blend < 1.5) { r = 1.0 - (1.0 - b.rgb) * (1.0 - c.rgb); }
  else if (blend < 2.5) { r = b.rgb * c.rgb; }
  return half4(r, b.a);
}
`;
}
