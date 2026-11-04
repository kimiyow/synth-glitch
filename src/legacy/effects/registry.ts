import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

export type EffectId =
  | "chromatic"
  | "scanlines"
  | "datamosh"
  | "vhs"
  | "pixelate"
  | "wave";

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
  {
    id: "vhs",
    label: "VHS",
    defaultControl: { x: 0.3, y: 0.35 },
    shader: `
      uniform shader image;
      uniform float2 resolution;
      uniform float2 param;
      uniform float time;

      half4 main(float2 xy) {
        float2 uv = xy / resolution;
        float scanline = floor(xy.y);
        float noise = fract(sin(scanline * 12.9898 + floor(time * 12.0) * 78.233) * 43758.5453);
        float jitter = (noise - 0.5) * 2.0 * param.x * 0.03 * resolution.x;
        float bandHeight = mix(0.01, 0.25, param.y);
        float bandCenter = fract(time * 0.12 + param.y * 0.5);
        float bandDistance = abs(fract(uv.y - bandCenter + 0.5) - 0.5);
        float tracking = 1.0 - smoothstep(bandHeight * 0.4, bandHeight * 0.5, bandDistance);
        float trackingJitter = (noise - 0.5) * tracking * param.y * 0.04 * resolution.x;
        float shiftedX = clamp(xy.x + jitter + trackingJitter, 0.0, resolution.x - 1.0);

        half4 base = image.eval(xy);
        half4 shifted = image.eval(float2(shiftedX, xy.y));
        half3 bandColor = shifted.rgb * 0.55 + half3(0.12);
        half3 rgb = mix(shifted.rgb, bandColor, tracking * 0.65);

        return half4(rgb, base.a);
      }
    `,
  },
  {
    id: "pixelate",
    label: "Pixelado",
    defaultControl: { x: 0.25, y: 0.4 },
    shader: `
      uniform shader image;
      uniform float2 resolution;
      uniform float2 param;

      half4 main(float2 xy) {
        float blockSize = max(1.0, mix(resolution.x * 0.005, resolution.x * 0.06, param.x));
        float2 sampleCoord = (floor(xy / blockSize) + 0.5) * blockSize;
        sampleCoord = clamp(sampleCoord, float2(0.0), resolution - 1.0);
        half4 base = image.eval(sampleCoord);
        float levels = mix(32.0, 3.0, param.y);
        float3 color = float3(base.rgb);
        half3 posterized = half3(floor(color * levels + 0.5) / levels);

        return half4(posterized, base.a);
      }
    `,
  },
  {
    id: "wave",
    label: "Ondulación",
    defaultControl: { x: 0.3, y: 0.25 },
    shader: `
      uniform shader image;
      uniform float2 resolution;
      uniform float2 param;

      half4 main(float2 xy) {
        float2 uv = xy / resolution;
        float amplitude = param.x * 0.05 * resolution.y;
        float frequency = mix(1.0, 20.0, param.y);
        float displacement = sin(uv.y * frequency * 6.2831853) * amplitude;
        float2 sampleCoord = float2(clamp(xy.x + displacement, 0.0, resolution.x - 1.0), xy.y);

        return image.eval(sampleCoord);
      }
    `,
  },
];

export const EFFECT_BY_ID = Object.fromEntries(
  EFFECTS.map((effect) => [effect.id, effect]),
) as Record<EffectId, EffectConfig>;

const runtimeEffects = Object.fromEntries(
  EFFECTS.map((effect) => [
    effect.id,
    Skia.RuntimeEffect.Make(effect.shader),
  ]),
) as Record<EffectId, SkRuntimeEffect | null>;

for (const effect of EFFECTS) {
  if (!runtimeEffects[effect.id]) {
    console.error(`No se pudo compilar el shader "${effect.id}".`);
  }
}

export function getRuntimeEffect(effectId: EffectId) {
  return runtimeEffects[effectId];
}

export const DEFAULT_EFFECT_ID: EffectId = "chromatic";
