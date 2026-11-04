import { Canvas, type SkImage } from "@shopify/react-native-skia";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { SceneRenderer } from "../../editor/SceneRenderer";
import { EFFECTS, EFFECT_BY_ID } from "../../engine/registry";
import type { FrameInputs } from "../../engine/renderGraph";
import type { EffectId, Layer } from "../../state/types";
import { colors, geometry, type } from "../../ui/tokens";
import { LabChip, labStyles } from "./labUi";
import { useTestImage } from "./testImage";
import { useLabClock } from "./useLabClock";

const GAP = 8;

function singleLayer(effect: EffectId): Layer[] {
  return [{ kind: "effect", id: effect, effect, params: { ...EFFECT_BY_ID[effect].defaults }, visible: true }];
}

/** M1: los 7 efectos con valores por defecto; toca uno para ajustar X/Y con el dedo. */
export function EffectsLab() {
  const image = useTestImage();
  const [selected, setSelected] = useState<EffectId | null>(null);

  if (!image) return <Text style={[labStyles.label, styles.pad]}>GENERANDO IMAGEN…</Text>;
  if (selected) return <EffectDetail image={image} effect={selected} onBack={() => setSelected(null)} />;
  return <EffectsGrid image={image} onSelect={setSelected} />;
}

function EffectsGrid({ image, onSelect }: { image: SkImage; onSelect: (id: EffectId) => void }) {
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - geometry.compactMargin * 2 - GAP) / 2);
  const tileH = Math.round((tileW * 4) / 3);
  const time = useLabClock();
  const frame = useDerivedValue<FrameInputs>(() => ({ time: time.get(), params: [] }));

  return (
    <ScrollView contentContainerStyle={styles.grid}>
      {EFFECTS.map((effect) => (
        <Pressable key={effect.id} accessibilityRole="button" onPress={() => onSelect(effect.id)} style={{ width: tileW }}>
          <Canvas style={{ width: tileW, height: tileH }}>
            <SceneRenderer image={image} width={tileW} height={tileH} layers={singleLayer(effect.id)} seed={0} frame={frame} />
          </Canvas>
          <Text style={styles.tileLabel}>
            {effect.label} · {effect.defaults.x.toFixed(2)}, {effect.defaults.y.toFixed(2)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function EffectDetail({ image, effect, onBack }: { image: SkImage; effect: EffectId; onBack: () => void }) {
  const { width } = useWindowDimensions();
  const canvasH = Math.round((width * 4) / 3);
  const defaults = EFFECT_BY_ID[effect].defaults;
  const [shown, setShown] = useState(defaults);
  const time = useLabClock();
  const px = useSharedValue(defaults.x);
  const py = useSharedValue(defaults.y);
  const frame = useDerivedValue<FrameInputs>(() => ({ time: time.get(), params: [px.get(), py.get()] }));

  // FX-04: 1 dedo ajusta X/Y (posición absoluta en el lienzo); doble toque reinicia.
  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin((e) => {
      px.set(Math.min(1, Math.max(0, e.x / width)));
      py.set(Math.min(1, Math.max(0, 1 - e.y / canvasH)));
    })
    .onUpdate((e) => {
      px.set(Math.min(1, Math.max(0, e.x / width)));
      py.set(Math.min(1, Math.max(0, 1 - e.y / canvasH)));
    })
    .onFinalize(() => {
      scheduleOnRN(setShown, { x: px.get(), y: py.get() });
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      px.set(defaults.x);
      py.set(defaults.y);
      scheduleOnRN(setShown, defaults);
    });

  return (
    <ScrollView>
      <GestureDetector gesture={Gesture.Exclusive(doubleTap, pan)}>
        <Canvas style={{ width, height: canvasH }}>
          <SceneRenderer image={image} width={width} height={canvasH} layers={singleLayer(effect)} seed={0} frame={frame} />
        </Canvas>
      </GestureDetector>
      <View style={labStyles.controls}>
        <Text style={labStyles.data}>
          {EFFECT_BY_ID[effect].label} · X {shown.x.toFixed(2)} · Y {shown.y.toFixed(2)}
        </Text>
        <Text style={labStyles.label}>
          ARRASTRA: IZQUIERDA→DERECHA = X, ABAJO→ARRIBA = Y · DOBLE TOQUE REINICIA
        </Text>
        <LabChip label="← TODOS LOS EFECTOS" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: geometry.compactMargin },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    padding: geometry.compactMargin,
  },
  tileLabel: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
    marginTop: 4,
  },
});
