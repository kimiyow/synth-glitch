import { Group, ImageShader, Rect, Shader, type SkImage } from "@shopify/react-native-skia";
import type { ReactElement } from "react";
import { isSharedValue, useDerivedValue, type DerivedValue } from "react-native-reanimated";

import { cropViewport, FULL_CROP, type CropRect } from "../engine/crop";
import { buildEffectChain, nodeUniforms, type ChainNode, type FrameInputs } from "../engine/renderGraph";
import { getEffectRuntime } from "../engine/runtimeEffects";
import type { Layer } from "../state/types";

type Props = {
  /** Original o buffer de pintura (valor compartido en el editor). */
  image: SkImage | DerivedValue<SkImage | null>;
  width: number;
  height: number;
  layers: readonly Layer[];
  seed: number;
  /**
   * Valor compartido en el preview (se anima en el hilo de UI) o un valor fijo
   * para exportar con drawAsImage. El árbol es el mismo en ambos casos (principio 1).
   */
  frame: FrameInputs | DerivedValue<FrameInputs>;
  /** Recorte no destructivo; sin él se muestra la imagen completa. */
  crop?: CropRect;
};

/**
 * Árbol de Skia de la escena: medio → efectos apilados → recorte (3.3). Va dentro de un
 * Canvas o de drawAsImage. `width × height` es el tamaño de salida (la región recortada).
 */
export function SceneRenderer({ image, width, height, layers, seed, frame, crop = FULL_CROP }: Props) {
  const chain = buildEffectChain(layers);
  // Los efectos se evalúan sobre la imagen completa, así el recorte no cambia su aspecto.
  const { fullW, fullH, tx, ty } = cropViewport(width, height, crop);
  const resolution: [number, number] = [fullW, fullH];

  let node: ReactElement = (
    <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, width: fullW, height: fullH }} tx="clamp" ty="clamp" />
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

  return (
    <Group clip={{ x: 0, y: 0, width, height }}>
      <Group transform={[{ translateX: -tx }, { translateY: -ty }]}>
        <Rect x={0} y={0} width={fullW} height={fullH}>
          {node}
        </Rect>
      </Group>
    </Group>
  );
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
  if (!source) return children;
  return (
    <Shader source={source} uniforms={uniforms}>
      {children}
    </Shader>
  );
}
