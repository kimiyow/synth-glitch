import { Canvas, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import { SceneRenderer } from "../../editor/SceneRenderer";
import { EFFECTS, GENERATORS } from "../../engine/registry";
import type { FrameInputs } from "../../engine/renderGraph";
import type { Layer } from "../../state/types";
import { colors, geometry, type } from "../../ui/tokens";
import { LabChip, labStyles } from "./labUi";
import { useTestImage } from "./testImage";
import { useLabClock } from "./useLabClock";

const GAP = 8;

type LabItem = { id: string; label: string; defaults: { x: number; y: number }; layers: Layer[] };

/** Los 7 efectos y los 3 generadores (M8, en `replace`), cada uno solo y con sus valores por defecto. */
const ITEMS: LabItem[] = [
  ...EFFECTS.map((e): LabItem => ({
    id: e.id,
    label: e.label,
    defaults: e.defaults,
    layers: [{ kind: "effect", id: e.id, effect: e.id, params: { ...e.defaults }, visible: true }],
  })),
  ...GENERATORS.map((g): LabItem => ({
    id: g.id,
    label: `GEN · ${g.label}`,
    defaults: g.defaults,
    layers: [{ kind: "generator", id: g.id, generator: g.id, params: { ...g.defaults }, visible: true, blend: "replace" }],
  })),
];

/** M1 y M8: efectos y generadores con valores por defecto; toca uno para ajustar X/Y con el dedo. */
export function EffectsLab() {
  const image = useTestImage();
  const [selected, setSelected] = useState<LabItem | null>(null);

  if (!image) return <Text style={[labStyles.label, styles.pad]}>GENERANDO IMAGEN…</Text>;
  if (selected) return <EffectDetail image={image} item={selected} onBack={() => setSelected(null)} />;
  return <EffectsGrid image={image} onSelect={setSelected} />;
}

function EffectsGrid({ image, onSelect }: { image: SkImage; onSelect: (item: LabItem) => void }) {
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - geometry.compactMargin * 2 - GAP) / 2);
  const tileH = Math.round((tileW * 4) / 3);
  const time = useLabClock();
  const frame = useDerivedValue<FrameInputs>(() => ({ time: time.get(), params: [] }));

  return (
    <ScrollView contentContainerStyle={styles.grid}>
      {ITEMS.map((effect) => (
        <Pressable key={effect.id} accessibilityRole="button" onPress={() => onSelect(effect)} style={{ width: tileW }}>
          <Canvas style={{ width: tileW, height: tileH }}>
            <SceneRenderer image={image} width={tileW} height={tileH} layers={effect.layers} seed={0} frame={frame} />
          </Canvas>
          <Text style={styles.tileLabel}>
            {effect.label} · {effect.defaults.x.toFixed(2)}, {effect.defaults.y.toFixed(2)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function EffectDetail({ image, item, onBack }: { image: SkImage; item: LabItem; onBack: () => void }) {
  const { width } = useWindowDimensions();
  const canvasH = Math.round((width * 4) / 3);
  const defaults = item.defaults;
  const [shown, setShown] = useState(defaults);
  const time = useLabClock();
  const px = useSharedValue(defaults.x);
  const py = useSharedValue(defaults.y);
  const frame = useDerivedValue<FrameInputs>(() => ({ time: time.get(), params: [px.get(), py.get()] }));

  // El texto X/Y se lee desde JS cada 250 ms; el hilo de UI no llama a JS (ver PerfHud).
  useEffect(() => {
    const id = setInterval(() => {
      const x = px.get();
      const y = py.get();
      setShown((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    }, 250);
    return () => clearInterval(id);
  }, [px, py]);

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
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      px.set(defaults.x);
      py.set(defaults.y);
    });

  return (
    <ScrollView>
      <GestureDetector gesture={Gesture.Exclusive(doubleTap, pan)}>
        <Canvas style={{ width, height: canvasH }}>
          <SceneRenderer image={image} width={width} height={canvasH} layers={item.layers} seed={0} frame={frame} />
        </Canvas>
      </GestureDetector>
      <View style={labStyles.controls}>
        <Text style={labStyles.data}>
          {item.label} · X {shown.x.toFixed(2)} · Y {shown.y.toFixed(2)}
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
