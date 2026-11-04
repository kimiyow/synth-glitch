export const chromaticShader = `
uniform shader image;
uniform float2 resolution;
uniform float2 param;

half4 main(float2 xy) {
  float angle = param.y * 6.2831853;
  float2 direction = float2(cos(angle), sin(angle));
  float2 offset = direction * param.x * 0.03 * resolution.x;

  half4 baseSample = image.eval(xy);
  half4 redSample = image.eval(xy + offset);
  half4 blueSample = image.eval(xy - offset);

  return half4(redSample.r, baseSample.g, blueSample.b, baseSample.a);
}
`;
