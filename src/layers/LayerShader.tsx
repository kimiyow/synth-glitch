import type { ReactNode } from "react";
import { Shader } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { getRuntimeEffect } from "../effects/registry";
import type { Layer } from "../state/types";

type LayerShaderProps = {
  layer: Layer;
  index: number;
  layerParams: SharedValue<number[]>;
  resolution: [number, number];
  time: SharedValue<number>;
  children: ReactNode;
};

export function LayerShader({
  layer,
  index,
  layerParams,
  resolution,
  time,
  children,
}: LayerShaderProps) {
  const uniforms = useDerivedValue(() => {
    const params = layerParams.get();
    return {
      resolution,
      param: [params[index * 2] ?? layer.params.x, params[index * 2 + 1] ?? layer.params.y],
      time: time.get(),
    };
  });
  const effect = getRuntimeEffect(layer.effect);

  if (!effect) {
    return children;
  }

  return (
    <Shader source={effect} uniforms={uniforms}>
      {children}
    </Shader>
  );
}
