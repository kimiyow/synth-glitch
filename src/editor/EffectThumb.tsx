import { Canvas, type SkImage } from "@shopify/react-native-skia";
import { memo } from "react";

import type { FrameInputs } from "../engine/renderGraph";
import type { Layer } from "../state/types";
import { SceneRenderer } from "./SceneRenderer";

/** Cuadro fijo: las miniaturas no se animan, así 10 lienzos pequeños no cuestan por cuadro. */
const STILL: FrameInputs = { time: 0.6, params: [] };

/** Miniatura de una ficha del panel Efectos: la imagen del proyecto con esa sola capa. */
export const EffectThumb = memo(function EffectThumb({
  image,
  layer,
  seed,
  size,
}: {
  image: SkImage | null;
  layer: Layer;
  seed: number;
  size: number;
}) {
  if (!image) return null;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <SceneRenderer image={image} width={size} height={size} layers={[layer]} seed={seed} frame={STILL} />
    </Canvas>
  );
});
