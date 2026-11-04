import {
  Canvas,
  FilterMode,
  Image as SkiaImage,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkRuntimeEffect,
  type SkSurface,
} from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnUI, useSharedValue } from "react-native-reanimated";

import { STAMP_SKSL } from "../../engine/stamps/stamps";
import { advanceStroke, STAMP_DEFAULTS, stampSeed, type StrokeCursor } from "../../paint/strokeInterpolate";
import type { StampEffect } from "../../state/types";
import { LabChip, labStyles } from "../lab/labUi";
import { makeTestImage, TEST_IMAGE_SIZE } from "../lab/testImage";

const EFFECTS: StampEffect[] = ["datamosh", "chromatic", "pixel", "smear"];
const SIZES = [0.05, 0.1, 0.2] as const;
const RUNTIME = Object.fromEntries(EFFECTS.map((e) => [e, Skia.RuntimeEffect.Make(STAMP_SKSL[e])])) as Record<
  StampEffect,
  SkRuntimeEffect | null
>;
const COMPILE_ERROR = Object.values(RUNTIME).some((r) => r === null) ? "un shader de sello no compiló" : null;

function nowMs() {
  "worklet";
  return performance.now();
}

/**
 * SP-03: dibujo incremental de sellos en una superficie fuera de pantalla desde el hilo de UI.
 * Mide FPS (HUD) y el costo medio por sello (NFR-04: ≤ 2 ms).
 */
export function Sp03Stamps() {
  const { width } = useWindowDimensions();
  const { width: bw, height: bh } = TEST_IMAGE_SIZE;
  const viewH = Math.round((width * bh) / bw);
  const scale = bw / width; // px del buffer por punto de pantalla

  const [effect, setEffect] = useState<StampEffect>("datamosh");
  const [size, setSize] = useState<number>(0.1);
  const error = COMPILE_ERROR;
  const [stats, setStats] = useState("");

  const surface = useSharedValue<SkSurface | null>(null);
  const shown = useSharedValue<SkImage | null>(null);
  const cursor = useSharedValue<StrokeCursor>(null);
  const strokeIndex = useSharedValue(0);
  const stampIndex = useSharedValue(0);
  const stampCount = useSharedValue(0);
  const stampMs = useSharedValue(0);
  const effectSv = useSharedValue<StampEffect>(effect);
  const sizeSv = useSharedValue(size);

  useEffect(() => effectSv.set(effect), [effect, effectSv]);
  useEffect(() => sizeSv.set(size), [size, sizeSv]);

  const reset = () => {
    const image = makeTestImage();
    if (!image) return;
    runOnUI(() => {
      "worklet";
      const s = Skia.Surface.MakeOffscreen(bw, bh);
      if (!s) return;
      s.getCanvas().drawImage(image, 0, 0);
      s.flush();
      surface.set(s);
      shown.set(s.makeImageSnapshot());
      stampCount.set(0);
      stampMs.set(0);
    })();
  };

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const n = stampCount.get();
      setStats(n ? `${n} sellos · ${(stampMs.get() / n).toFixed(2)} ms por sello (meta ≤ 2 ms)` : "pinta con un dedo");
    }, 500);
    return () => clearInterval(id);
  }, [stampCount, stampMs]);

  const paintAt = (x: number, y: number) => {
    "worklet";
    const s = surface.get();
    if (!s) return;
    const sizePx = sizeSv.get() * bw;
    const r = advanceStroke(cursor.get(), x * scale, y * scale, sizePx);
    cursor.set(r.cursor);
    const fx = effectSv.get();
    const rt = RUNTIME[fx];
    if (!rt || r.stamps.length === 0) return;
    const canvas = s.getCanvas();
    const t0 = nowMs();
    for (const p of r.stamps) {
      const x0 = p.x - sizePx / 2;
      const y0 = p.y - sizePx / 2;
      // Instantánea previa (copia al escribir) de la zona que el sello puede leer.
      const pad = sizePx;
      const bx = Math.max(0, Math.floor(x0 - pad));
      const by = Math.max(0, Math.floor(y0 - pad));
      const bwid = Math.min(bw, Math.ceil(x0 + sizePx + pad)) - bx;
      const bhei = Math.min(bh, Math.ceil(y0 + sizePx + pad)) - by;
      if (bwid <= 0 || bhei <= 0) continue;
      const snap = s.makeImageSnapshot(Skia.XYWHRect(bx, by, bwid, bhei));
      const child = snap.makeShaderOptions(
        TileMode.Clamp,
        TileMode.Clamp,
        FilterMode.Nearest,
        MipmapMode.None,
        Skia.Matrix().translate(bx, by),
      );
      const params = STAMP_DEFAULTS[fx];
      const seed = stampSeed(7, strokeIndex.get(), stampIndex.get());
      stampIndex.set(stampIndex.get() + 1);
      const paint = Skia.Paint();
      paint.setShader(
        rt.makeShaderWithChildren([x0, y0, x0 + sizePx, y0 + sizePx, seed, params[0], params[1] ?? 0], [child]),
      );
      canvas.drawRect(Skia.XYWHRect(x0, y0, sizePx, sizePx), paint);
    }
    s.flush();
    stampMs.set(stampMs.get() + nowMs() - t0);
    stampCount.set(stampCount.get() + r.stamps.length);
    shown.set(s.makeImageSnapshot());
  };

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(0)
    .onBegin((e) => {
      cursor.set(null);
      stampIndex.set(0);
      paintAt(e.x, e.y);
    })
    .onUpdate((e) => paintAt(e.x, e.y))
    .onFinalize(() => {
      strokeIndex.set(strokeIndex.get() + 1);
    });

  return (
    <ScrollView scrollEnabled={false}>
      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height: viewH }}>
          <SkiaImage image={shown} x={0} y={0} width={width} height={viewH} fit="fill" />
        </Canvas>
      </GestureDetector>
      <View style={labStyles.controls}>
        {error && <Text style={labStyles.data}>✗ {error}</Text>}
        <Text style={labStyles.data}>{stats}</Text>
        <View style={labStyles.row}>
          {EFFECTS.map((e) => (
            <LabChip key={e} label={e.toUpperCase()} active={e === effect} onPress={() => setEffect(e)} />
          ))}
        </View>
        <View style={labStyles.row}>
          {SIZES.map((s) => (
            <LabChip key={s} label={`${s * 100} %`} active={s === size} onPress={() => setSize(s)} />
          ))}
          <LabChip label="LIMPIAR" onPress={reset} />
        </View>
        <Text style={labStyles.label}>
          Pinta rápido 10 s con cada tamaño y anota los UI fps del HUD y los ms por sello.
        </Text>
      </View>
    </ScrollView>
  );
}
