import {
  Canvas,
  drawAsImage,
  Fill,
  ImageFormat,
  Shader,
} from "@shopify/react-native-skia";
import { useState, type ReactElement, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { colors, geometry, type } from "../../ui/tokens";
import { SPIKE_SOURCE, SPIKE_WAVE } from "./spikeShaders";

const LAYER_OPTIONS = [1, 3, 5, 8] as const;
const EXPORT_SIZE = { width: 4000, height: 3000 }; // 12 MP

/**
 * SP-01: uniforms desde valores compartidos a ≥ 55 FPS y drawAsImage a 12 MP.
 * Arrastra sobre el lienzo y mira el HUD (UI fps). Todo el camino es hilo de UI.
 */
export function Sp01Uniforms() {
  const { width } = useWindowDimensions();
  const canvasW = width;
  const canvasH = Math.round((width * 4) / 3);
  const [layerCount, setLayerCount] = useState<number>(3);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const time = useSharedValue(0);
  const px = useSharedValue(0.3);
  const py = useSharedValue(0.3);

  useFrameCallback((info) => {
    time.value = info.timeSinceFirstFrame / 1000;
  });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin((e) => {
      px.value = clamp01(e.x / canvasW);
      py.value = clamp01(e.y / canvasH);
    })
    .onUpdate((e) => {
      px.value = clamp01(e.x / canvasW);
      py.value = clamp01(e.y / canvasH);
    });

  const resolution: [number, number] = [canvasW, canvasH];

  const runExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const res: [number, number] = [EXPORT_SIZE.width, EXPORT_SIZE.height];
      const tree = buildStaticTree(layerCount, res, [px.value, py.value], time.value);
      const t0 = performance.now();
      const image = await drawAsImage(<Fill>{tree}</Fill>, EXPORT_SIZE);
      const t1 = performance.now();
      if (!image) {
        setExportResult("✗ drawAsImage devolvió null");
        return;
      }
      const bytes = image.encodeToBytes(ImageFormat.JPEG, 90);
      const t2 = performance.now();
      image.dispose();
      setExportResult(
        `✓ ${EXPORT_SIZE.width}×${EXPORT_SIZE.height} · ${layerCount} capas\n` +
          `drawAsImage ${(t1 - t0).toFixed(0)} ms · JPEG ${(t2 - t1).toFixed(0)} ms · ` +
          `${(bytes.length / 1024 / 1024).toFixed(1)} MB`,
      );
    } catch (error) {
      setExportResult(`✗ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView>
      <GestureDetector gesture={pan}>
        <Canvas style={{ width: canvasW, height: canvasH }}>
          <Fill>
            <LiveTree
              layerCount={layerCount}
              resolution={resolution}
              px={px}
              py={py}
              time={time}
            />
          </Fill>
        </Canvas>
      </GestureDetector>

      <View style={styles.controls}>
        <Text style={styles.label}>CAPAS (wave)</Text>
        <View style={styles.row}>
          {LAYER_OPTIONS.map((n) => (
            <Chip key={n} active={n === layerCount} onPress={() => setLayerCount(n)}>
              {String(n)}
            </Chip>
          ))}
        </View>
        <Chip active={false} onPress={runExport} disabled={exporting}>
          {exporting ? "EXPORTANDO…" : "EXPORTAR 12 MP"}
        </Chip>
        {exportResult && <Text style={styles.result}>{exportResult}</Text>}
        <Text style={styles.hint}>
          Mide con --no-dev --minify. Arrastra 10 s por cada número de capas y anota los UI fps del HUD.
        </Text>
      </View>
    </ScrollView>
  );
}

function clamp01(v: number) {
  "worklet";
  return Math.min(1, Math.max(0, v));
}

type LiveProps = {
  layerCount: number;
  resolution: [number, number];
  px: SharedValue<number>;
  py: SharedValue<number>;
  time: SharedValue<number>;
};

function LiveTree({ layerCount, resolution, px, py, time }: LiveProps) {
  let node: ReactNode = <LiveSource resolution={resolution} time={time} />;
  for (let i = 0; i < layerCount; i++) {
    node = (
      <LiveLayer key={i} index={i} resolution={resolution} px={px} py={py}>
        {node}
      </LiveLayer>
    );
  }
  return <>{node}</>;
}

function LiveSource({ resolution, time }: { resolution: [number, number]; time: SharedValue<number> }) {
  const uniforms = useDerivedValue(() => ({ resolution, time: time.value }));
  return <Shader source={SPIKE_SOURCE} uniforms={uniforms} />;
}

function LiveLayer({
  index,
  resolution,
  px,
  py,
  children,
}: {
  index: number;
  resolution: [number, number];
  px: SharedValue<number>;
  py: SharedValue<number>;
  children: ReactNode;
}) {
  // Cada capa recibe una fracción distinta para que no se anulen entre sí.
  const scale = 1 / (index + 1);
  const uniforms = useDerivedValue(() => ({
    resolution,
    param: [px.value * scale, py.value],
  }));
  return (
    <Shader source={SPIKE_WAVE} uniforms={uniforms}>
      {children}
    </Shader>
  );
}

function buildStaticTree(
  layerCount: number,
  resolution: [number, number],
  param: [number, number],
  time: number,
): ReactElement {
  let node: ReactElement = <Shader source={SPIKE_SOURCE} uniforms={{ resolution, time }} />;
  for (let i = 0; i < layerCount; i++) {
    const scale = 1 / (i + 1);
    node = (
      <Shader source={SPIKE_WAVE} uniforms={{ resolution, param: [param[0] * scale, param[1]] }}>
        {node}
      </Shader>
    );
  }
  return node;
}

function Chip({
  active,
  disabled,
  onPress,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: { padding: geometry.compactMargin, gap: 12 },
  row: { flexDirection: "row", gap: 8 },
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  chip: {
    minHeight: geometry.target,
    minWidth: geometry.target,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: geometry.hairline,
  },
  chipActive: { backgroundColor: colors.paper },
  chipDisabled: { opacity: 0.5 },
  chipText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  chipTextActive: { color: colors.paperText },
  result: { color: colors.inkText, fontFamily: "Menlo", fontSize: type.data },
  hint: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label },
});
