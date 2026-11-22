import { Canvas, Circle, Group, Path, Skia } from "@shopify/react-native-skia";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useDerivedValue } from "react-native-reanimated";

import type { GestureClip } from "../domain/types";
import { gestureValue } from "../modulation/sources";
import { colors } from "../ui/tokens";
import type { ModBus } from "./modBus";

const DOT = 7;

// estela del gesto sobre el lienzo: el recorrido grabado (tenue) y un punto que lo sigue al ritmo
// del bucle, como un dedo invisible. Usa la misma área y orientación que la grabación (izquierda →
// derecha = 0 → 1, abajo → arriba = 0 → 1). Solo es una guía del editor: no se exporta
export function GestureTrail({ bus, clip }: { bus: ModBus; clip: GestureClip }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;

  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    const frames = Math.floor(clip.samples.length / 2);
    for (let i = 0; i < frames; i++) {
      const x = clip.mirrorX ? 1 - clip.samples[i * 2] : clip.samples[i * 2];
      const y = clip.mirrorY ? 1 - clip.samples[i * 2 + 1] : clip.samples[i * 2 + 1];
      if (i === 0) b.moveTo(x * w, (1 - y) * h);
      else b.lineTo(x * w, (1 - y) * h);
    }
    return b.detach();
  }, [clip, w, h]);

  const cx = useDerivedValue(() => (gestureValue(clip, bus.time.get(), 0) ?? 0.5) * w);
  const cy = useDerivedValue(() => (1 - (gestureValue(clip, bus.time.get(), 1) ?? 0.5)) * h);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {w > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          {/* contorno oscuro bajo la línea blanca: se lee sobre imágenes claras y oscuras */}
          <Path path={path} style="stroke" strokeWidth={4} strokeJoin="round" strokeCap="round" color={colors.scrim} />
          <Path path={path} style="stroke" strokeWidth={1.5} strokeJoin="round" strokeCap="round" color={colors.inkLineStrong} />
          <Group>
            <Circle cx={cx} cy={cy} r={DOT + 2} color={colors.scrim} />
            <Circle cx={cx} cy={cy} r={DOT} color={colors.paper} />
          </Group>
        </Canvas>
      )}
    </View>
  );
}
