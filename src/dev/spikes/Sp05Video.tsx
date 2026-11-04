import { Canvas, useVideo } from "@shopify/react-native-skia";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useDerivedValue } from "react-native-reanimated";

import { SceneRenderer } from "../../editor/SceneRenderer";
import type { FrameInputs } from "../../engine/renderGraph";
import type { Layer } from "../../state/types";
import { geometry } from "../../ui/tokens";
import { LabChip, labStyles } from "../lab/labUi";
import { useLabClock } from "../lab/useLabClock";

const VHS: Layer[] = [{ kind: "effect", id: "vhs", effect: "vhs", params: { x: 0.3, y: 0.4 }, visible: true }];
const ROTATIONS = [0, 90, 180, 270] as const;

/**
 * SP-05: ¿`useVideo` de Skia reproduce un clip con shader en Expo Go? Mide el giro que
 * reporta el video y permite forzarlo para confirmar a ojo cuál endereza la imagen.
 */
export function Sp05Video() {
  const [uri, setUri] = useState<string | null>(null);
  const [override, setOverride] = useState<(typeof ROTATIONS)[number] | null>(null);
  const [withFx, setWithFx] = useState(true);
  const { width } = useWindowDimensions();
  const { currentFrame, rotation, size, framerate, duration } = useVideo(uri, { looping: true, volume: 0 });
  const time = useLabClock();
  const frame = useDerivedValue<FrameInputs>(() => ({ time: time.get(), params: [] }));
  const rot = override ?? rotation;
  const sideways = rot === 90 || rot === 270;
  const w = sideways ? size.height : size.width;
  const h = sideways ? size.width : size.height;
  const canvasW = width - geometry.compactMargin * 2;
  const canvasH = w > 0 ? Math.round((canvasW * h) / w) : canvasW;

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 1 });
    if (!result.canceled) setUri(result.assets[0].uri);
  };

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <LabChip label={uri ? "OTRO VIDEO" : "ELEGIR VIDEO DE FOTOS"} onPress={pick} />
      {uri && (
        <>
          <Canvas style={{ width: canvasW, height: canvasH }}>
            <SceneRenderer
              image={currentFrame}
              width={canvasW}
              height={canvasH}
              layers={withFx ? VHS : []}
              seed={0}
              frame={frame}
              rotation={rot}
            />
          </Canvas>
          <Text style={labStyles.data}>
            GIRO REPORTADO {rotation}° · {size.width}×{size.height} · {framerate.toFixed(0)} FPS · {duration.toFixed(1)} S
          </Text>
          <Text style={labStyles.label}>FORZAR GIRO (la imagen debe verse derecha):</Text>
          <View style={styles.row}>
            <LabChip label={override === null ? "● AUTO" : "AUTO"} onPress={() => setOverride(null)} />
            {ROTATIONS.map((r) => (
              <LabChip key={r} label={override === r ? `● ${r}°` : `${r}°`} onPress={() => setOverride(r)} />
            ))}
          </View>
          <LabChip label={withFx ? "QUITAR VHS" : "PONER VHS"} onPress={() => setWithFx((v) => !v)} />
          <Text style={labStyles.label}>Mira el FPS en el HUD con y sin VHS; la meta es ≥ 55.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: geometry.compactMargin, gap: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
