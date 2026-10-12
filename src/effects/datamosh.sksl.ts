export const datamoshShader = `
uniform shader image;
uniform float2 resolution;
uniform float2 param;

half4 main(float2 xy) {
  float2 uv = xy / resolution;
  float bandCount = mix(8.0, 30.0, param.x);
  float stripe = floor(uv.y * bandCount);
  float shift = (fract(stripe * 0.73) - 0.5) * param.y * 0.25 * resolution.x;
  float2 distorted = float2(xy.x + shift, xy.y);

  half4 base = image.eval(xy);
  half4 shifted = image.eval(distorted);

  return half4(shifted.r, base.g, shifted.b, base.a);
}
`;
