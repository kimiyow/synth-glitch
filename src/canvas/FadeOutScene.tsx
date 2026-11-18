import { Group, type SkImage } from "@shopify/react-native-skia";
import { useDerivedValue, type DerivedValue, type SharedValue } from "react-native-reanimated";

import type { Layer, Route, SourceConfig } from "../domain/types";
import type { CropRect } from "../engine/crop";
import { buildLayerChain, type FrameInputs } from "../engine/renderGraph";
import { evaluate } from "../modulation/evaluate";
import { SceneRenderer } from "../render/SceneRenderer";
import { oriInput, type ModBus } from "./modBus";

// escena que se va durante un crossfade: sus capas y modulaciones, cuándo empezó (reloj del
// preview, s) y cuánto dura
export type SceneFade = { layers: readonly Layer[]; routes: readonly Route[]; start: number; duration: number };

type Props = {
  fade: SceneFade;
  bus: ModBus;
  micLevel: SharedValue<number>;
  image: SkImage | DerivedValue<SkImage | null>;
  width: number;
  height: number;
  sources: SourceConfig;
  seed: number;
  crop?: CropRect;
  rotation?: 0 | 90 | 180 | 270;
  sourceSize?: { width: number; height: number };
};

// la escena anterior dibujada encima de la nueva, con opacidad que baja de 1 a 0 a lo largo del
// fundido. Sigue animando con sus propias modulaciones mientras se desvanece
export function FadeOutScene({ fade, bus, micLevel, image, width, height, sources, seed, crop, rotation, sourceSize }: Props) {
  const chain = buildLayerChain(fade.layers).map((n) => ({ id: n.layerId, params: n.base }));
  const { routes, start, duration } = fade;
  const frame = useDerivedValue<FrameInputs>(() => {
    const t = bus.time.get();
    const inputs = {
      touch: {},
      gateOnAt: bus.gateOn.get(),
      gateOffAt: bus.gateOff.get(),
      orientation: oriInput(bus),
      mic: micLevel.get(),
      micHitAt: bus.micHitAt.get(),
      track: null,
      rec: null,
    };
    return { time: t, params: evaluate(chain, routes, sources, t, inputs, seed) };
  });
  const opacity = useDerivedValue(() => {
    const u = duration > 0 ? (bus.time.get() - start) / duration : 1;
    return 1 - Math.min(1, Math.max(0, u));
  });
  return (
    <Group opacity={opacity}>
      <SceneRenderer
        image={image}
        width={width}
        height={height}
        layers={fade.layers}
        seed={seed}
        frame={frame}
        crop={crop}
        rotation={rotation}
        sourceSize={sourceSize}
      />
    </Group>
  );
}
