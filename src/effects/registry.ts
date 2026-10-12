export type EffectId = "chromatic" | "scanlines" | "datamosh";

export type EffectConfig = {
  id: EffectId;
  label: string;
  defaultControl: {
    x: number;
    y: number;
  };
  shader: string;
};

export const EFFECTS: EffectConfig[] = [
  {
    id: "chromatic",
    label: "Chromatic",
    defaultControl: { x: 0.3, y: 0.15 },
    shader: `
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
    `,
  },
  {
    id: "scanlines",
    label: "Scanlines",
    defaultControl: { x: 0.45, y: 0.25 },
    shader: `
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
    `,
  },
  {
    id: "datamosh",
    label: "Datamosh",
    defaultControl: { x: 0.3, y: 0.35 },
    shader: `
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
    `,
  },
];

export const EFFECT_BY_ID = Object.fromEntries(
  EFFECTS.map((effect) => [effect.id, effect]),
) as Record<EffectId, EffectConfig>;

export const DEFAULT_EFFECT_ID: EffectId = "chromatic";
