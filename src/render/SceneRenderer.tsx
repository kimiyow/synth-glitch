import { Group, ImageShader, Rect, Shader, Skia, type SkImage } from "@shopify/react-native-skia";
import type { ReactElement } from "react";
import { isSharedValue, useDerivedValue, type DerivedValue } from "react-native-reanimated";

import { cropViewport, FULL_CROP, type CropRect } from "../engine/crop";
import { buildLayerChain, nodeUniforms, type ChainNode, type FrameInputs } from "../engine/renderGraph";
import { getEffectRuntime, getGeneratorRuntime } from "../engine/runtimeEffects";
import type { Layer } from "../domain/types";

// capa PINTURA: la imagen pintada se compone sobre la cadena donde la máscara tiene sellos, justo
// encima de los `at` primeros nodos (0 = sobre la imagen, debajo de todas las capas)
export type PaintInput = {
  image: SkImage | DerivedValue<SkImage | null>;
  mask: SkImage | DerivedValue<SkImage>;
  at: number;
};

type Props = {
  // medio sin pintura (valor compartido con los cuadros de un clip)
  image: SkImage | DerivedValue<SkImage | null>;
  width: number;
  height: number;
  layers: readonly Layer[];
  seed: number;
  // valor compartido en el preview (se anima en el hilo de UI) o un valor fijo para exportar con
  // drawAsImage. El árbol es el mismo en ambos casos
  frame: FrameInputs | DerivedValue<FrameInputs>;
  // recorte no destructivo; sin él se muestra la imagen completa
  crop?: CropRect;
  // giro del medio (clips: los cuadros del video llegan sin rotar)
  rotation?: 0 | 90 | 180 | 270;
  // tamaño del cuadro sin rotar; necesario cuando hay giro (el cuadro es un valor compartido)
  sourceSize?: { width: number; height: number };
  // capa PINTURA (solo imágenes fijas); null o ausente = sin pintura
  paint?: PaintInput | null;
};

// pintura encima de la cadena donde la máscara tiene sellos
const PAINT_OVER = Skia.RuntimeEffect.Make(`
uniform shader below;
uniform shader paint;
uniform shader mask;
half4 main(float2 p) {
  return mask.eval(p).a > 0.5 ? paint.eval(p) : below.eval(p);
}`);

// árbol de Skia de la escena: medio → capas de efecto y generador apiladas → recorte. Va dentro de
// un Canvas o de drawAsImage. width × height es el tamaño de salida (la región recortada)
export function SceneRenderer({ image, width, height, layers, seed, frame, crop = FULL_CROP, rotation = 0, sourceSize, paint }: Props) {
  const chain = buildLayerChain(layers);
  // la pintura va encima del nodo paintAt - 1 (clips: no hay pintura)
  const paintAt = paint && PAINT_OVER && rotation === 0 ? Math.min(chain.length, Math.max(0, paint.at)) : -1;
  // los efectos se evalúan sobre la imagen completa, así el recorte no cambia su aspecto
  const { fullW, fullH, tx, ty } = cropViewport(width, height, crop);
  const resolution: [number, number] = [fullW, fullH];

  // con giro no sirve fit + transform: Skia gira en coordenadas del cuadro antes de ajustarlo, el
  // cuadro queda desplazado y el borde estirado (clamp) parece un efecto. La matriz completa:
  // centrar el cuadro, escalar (cover), girar y llevarlo al centro
  const rotated = rotation !== 0 && sourceSize && sourceSize.width > 0 && sourceSize.height > 0;
  const fullRect = { x: 0, y: 0, width: fullW, height: fullH };
  let node: ReactElement = rotated ? (
    <ImageShader image={image} fit="none" tx="clamp" ty="clamp" matrix={coverMatrix(sourceSize, rotation, fullW, fullH)} />
  ) : (
    <ImageShader image={image} fit="cover" rect={fullRect} tx="clamp" ty="clamp" />
  );
  const paintOver = (below: ReactElement, key: string) =>
    paint && PAINT_OVER ? (
      <Shader key={key} source={PAINT_OVER} uniforms={{}}>
        {below}
        <ImageShader image={paint.image} fit="cover" rect={fullRect} tx="clamp" ty="clamp" />
        <ImageShader image={paint.mask} fit="cover" rect={fullRect} tx="decal" ty="decal" />
      </Shader>
    ) : (
      below
    );
  if (paintAt === 0) node = paintOver(node, "pintura");
  chain.forEach((chainNode, index) => {
    const source = runtimeFor(chainNode);
    // un shader que no compila se salta en lugar de romper la cadena
    if (!source) {
      if (index === paintAt - 1) node = paintOver(node, `${chainNode.layerId}-pintura`);
      return;
    }
    // la key por capa evita que React reutilice el nodo de otra capa: un generador con los uniforms
    // de un efecto (sin blend) hace que Skia falle en el hilo de UI y cierra la app
    node = isLiveFrame(frame) ? (
      <LiveEffect key={chainNode.layerId} chain={chain} index={index} frame={frame} resolution={resolution} seed={seed}>
        {node}
      </LiveEffect>
    ) : (
      <Shader key={chainNode.layerId} source={source} uniforms={nodeUniforms(chain, index, frame, resolution, seed)}>
        {node}
      </Shader>
    );
    if (index === paintAt - 1) node = paintOver(node, `${chainNode.layerId}-pintura`);
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

function coverMatrix(src: { width: number; height: number }, rotation: number, w: number, h: number) {
  const sideways = rotation === 90 || rotation === 270;
  const rw = sideways ? src.height : src.width;
  const rh = sideways ? src.width : src.height;
  const s = Math.max(w / rw, h / rh);
  const m = Skia.Matrix();
  m.translate(w / 2, h / 2);
  m.rotate((rotation * Math.PI) / 180);
  m.scale(s, s);
  m.translate(-src.width / 2, -src.height / 2);
  return m;
}

function runtimeFor(node: ChainNode) {
  return node.kind === "effect" ? getEffectRuntime(node.effect) : getGeneratorRuntime(node.generator);
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
  const source = runtimeFor(chain[index]);
  if (!source) return children;
  return (
    <Shader source={source} uniforms={uniforms}>
      {children}
    </Shader>
  );
}
