import { Fill, ImageShader, Shader, type SkImage } from "@shopify/react-native-skia";
import type { ReactElement } from "react";
import { isSharedValue, useDerivedValue, type DerivedValue } from "react-native-reanimated";

import { buildEffectChain, nodeUniforms, type ChainNode, type FrameInputs } from "../engine/renderGraph";
import { getEffectRuntime } from "../engine/runtimeEffects";
import type { Layer } from "../state/types";

type Props = {
  image: SkImage;
  width: number;
  height: number;
  layers: readonly Layer[];
  seed: number;
  /**
   * Valor compartido en el preview (se anima en el hilo de UI) o un valor fijo
   * para exportar con drawAsImage. El árbol es el mismo en ambos casos (principio 1).
   */
  frame: FrameInputs | DerivedValue<FrameInputs>;
};

/** Árbol de Skia de la escena: medio → efectos apilados. Va dentro de un Canvas o de drawAsImage. */
export function SceneRenderer({ image, width, height, layers, seed, frame }: Props) {
  const chain = buildEffectChain(layers);
  const resolution: [number, number] = [width, height];

  let node: ReactElement = (
    <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, width, height }} tx="clamp" ty="clamp" />
  );
  chain.forEach((chainNode, index) => {
    const source = getEffectRuntime(chainNode.effect);
    if (!source) return; // Un shader que no compila se salta en lugar de romper la cadena.
    node = isLiveFrame(frame) ? (
      <LiveEffect chain={chain} index={index} frame={frame} resolution={resolution} seed={seed}>
        {node}
      </LiveEffect>
    ) : (
      <Shader source={source} uniforms={nodeUniforms(chain, index, frame, resolution, seed)}>
        {node}
      </Shader>
    );
  });

  return <Fill>{node}</Fill>;
}

function isLiveFrame(frame: FrameInputs | DerivedValue<FrameInputs>): frame is DerivedValue<FrameInputs> {
  return isSharedValue(frame);
}

function LiveEffect({
  chain,
  index,
  frame,
  resolution,
  seed,
  children,
}: {
  chain: ChainNode[];
  index: number;
  frame: DerivedValue<FrameInputs>;
  resolution: [number, number];
  seed: number;
  children: ReactElement;
}) {
  const uniforms = useDerivedValue(() => nodeUniforms(chain, index, frame.get(), resolution, seed));
  const source = getEffectRuntime(chain[index].effect);
  return (
    <Shader source={source!} uniforms={uniforms}>
      {children}
    </Shader>
  );
}
