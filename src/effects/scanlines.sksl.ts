export const scanlinesShader = `
uniform shader image;
uniform float2 resolution;
uniform float2 param;
uniform float time;

half4 main(float2 xy) {
  float2 uv = xy / resolution;
  float scanline = 0.5 + 0.5 * sin(uv.y * mix(80.0, 400.0, param.x) * 6.2831853 + time * 0.6);
  float noise = fract(sin(dot(floor(uv * 720.0), float2(12.9898, 78.233))) * 43758.5453);

  half4 base = image.eval(xy);
  float glow = mix(1.0, 0.55, scanline);
  half3 rgb = base.rgb * glow + (noise - 0.5) * (param.y * 0.35);

  return half4(clamp(rgb, 0.0, 1.0), base.a);
}
`;
