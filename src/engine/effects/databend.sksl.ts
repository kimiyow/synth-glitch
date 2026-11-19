import { EFFECT_HEADER } from "./contract";

// databending simulado: la imagen se lee como si se hubieran editado sus bytes. En 24 franjas, las
// "corruptas" se desplazan con vuelta al borde y se inclinan (stride roto); los canales se leen con
// desfase y, en algunas franjas, se reducen de bits o se intercambian.
// x: corrupción (cuántas franjas y cuánto se mueven); y: canales (desfase RGB, bits y cruce)
export const DATABEND_SKSL = `${EFFECT_HEADER}
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
half4 main(float2 xy) {
  float bandH = resolution.y / 24.0;
  float band = floor(xy.y / bandH);
  float hit = step(hash(float2(band, seed)), param.x * 0.7);
  float local = (xy.y - band * bandH) / bandH;
  float shift = hit * hash(float2(band, seed + 3.0)) * param.x * resolution.x;
  float shear = hit * (hash(float2(band, seed + 5.0)) - 0.5) * param.x * 0.6 * resolution.x;
  float x = xy.x + shift + local * shear;
  float dx = param.y * 0.04 * resolution.x;
  float w = resolution.x;
  half4 g = image.eval(float2(mod(x, w), xy.y));
  half r = image.eval(float2(mod(x + dx, w), xy.y)).r;
  half b = image.eval(float2(mod(x - dx * 2.0 + w, w), xy.y)).b;
  half3 c = half3(r, g.g, b);
  float hb = hash(float2(band, seed + 7.0));
  if (hit > 0.5 && hb < param.y) {
    half levels = half(mix(32.0, 3.0, param.y));
    c = floor(c * levels) / levels;
  }
  if (hit > 0.5 && hb < param.y * 0.4) c = c.brg;
  return half4(c, g.a);
}
`;
