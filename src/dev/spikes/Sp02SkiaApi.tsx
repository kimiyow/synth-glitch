import {
  AlphaType,
  ColorType,
  drawAsImage,
  Fill,
  ImageFormat,
  Skia,
  type SkImage,
} from "@shopify/react-native-skia";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { colors, geometry, type } from "../../ui/tokens";

type CheckResult = { name: string; ok: boolean; detail: string; ms: number };

const SIZE = 64;
const RGBA_INFO = {
  width: SIZE,
  height: SIZE,
  colorType: ColorType.RGBA_8888,
  alphaType: AlphaType.Unpremul,
};

/** SP-02: drawAsImage, readPixels, encodeToBytes y superficies fuera de pantalla. */
export function Sp02SkiaApi() {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults(await runChecks());
    setRunning(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Pressable
        accessibilityRole="button"
        disabled={running}
        onPress={run}
        style={[styles.button, running && styles.disabled]}
      >
        <Text style={styles.buttonText}>{running ? "EJECUTANDO…" : "EJECUTAR"}</Text>
      </Pressable>
      {results?.map((r) => (
        <Text key={r.name} style={[styles.line, !r.ok && styles.fail]}>
          {r.ok ? "✓" : "✗"} {r.name} · {r.ms.toFixed(1)} ms{"\n"}  {r.detail}
        </Text>
      ))}
    </ScrollView>
  );
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const check = async (name: string, fn: () => string | Promise<string>) => {
    const t0 = performance.now();
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail, ms: performance.now() - t0 });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      results.push({ name, ok: false, detail, ms: performance.now() - t0 });
    }
  };

  let offscreenImage: SkImage | null = null;
  let drawnImage: SkImage | null = null;

  await check("Surface.MakeOffscreen + makeImageSnapshot", () => {
    const surface = Skia.Surface.MakeOffscreen(SIZE, SIZE);
    if (!surface) throw new Error("MakeOffscreen devolvió null");
    const paint = Skia.Paint();
    paint.setColor(Skia.Color("#00FF00"));
    surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, SIZE, SIZE), paint);
    surface.flush();
    offscreenImage = surface.makeImageSnapshot().makeNonTextureImage();
    if (!offscreenImage) throw new Error("makeNonTextureImage devolvió null");
    return `${offscreenImage.width()}×${offscreenImage.height()}`;
  });

  await check("readPixels (superficie)", () => {
    if (!offscreenImage) throw new Error("sin imagen previa");
    return describePixel(offscreenImage, [0, 255, 0]);
  });

  await check("drawAsImage", async () => {
    drawnImage = await drawAsImage(<Fill color="#FF0000" />, { width: SIZE, height: SIZE });
    if (!drawnImage) throw new Error("drawAsImage devolvió null");
    return `${drawnImage.width()}×${drawnImage.height()}`;
  });

  await check("readPixels (drawAsImage)", () => {
    if (!drawnImage) throw new Error("sin imagen previa");
    return describePixel(drawnImage, [255, 0, 0]);
  });

  await check("encodeToBytes JPEG", () => {
    if (!drawnImage) throw new Error("sin imagen previa");
    const bytes = drawnImage.encodeToBytes(ImageFormat.JPEG, 90);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("cabecera JPEG inválida");
    return `${bytes.length} bytes, cabecera FF D8`;
  });

  await check("encodeToBytes PNG", () => {
    if (!drawnImage) throw new Error("sin imagen previa");
    const bytes = drawnImage.encodeToBytes(ImageFormat.PNG);
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50) throw new Error("cabecera PNG inválida");
    return `${bytes.length} bytes, cabecera 89 50`;
  });

  (offscreenImage as SkImage | null)?.dispose();
  (drawnImage as SkImage | null)?.dispose();
  return results;
}

function describePixel(image: SkImage, expected: [number, number, number]) {
  const pixels = image.readPixels(0, 0, RGBA_INFO);
  if (!pixels) throw new Error("readPixels devolvió null");
  if (pixels.length !== SIZE * SIZE * 4) {
    throw new Error(`longitud ${pixels.length}, se esperaba ${SIZE * SIZE * 4}`);
  }
  const center = ((SIZE / 2) * SIZE + SIZE / 2) * 4;
  const rgb = [pixels[center], pixels[center + 1], pixels[center + 2]];
  const matches = rgb.every((v, i) => Math.abs(v - expected[i]) <= 2);
  if (!matches) throw new Error(`píxel (${rgb.join(", ")}), se esperaba (${expected.join(", ")})`);
  return `${pixels.constructor.name} · píxel central (${rgb.join(", ")})`;
}

const styles = StyleSheet.create({
  root: { padding: geometry.compactMargin, gap: 12 },
  button: {
    minHeight: geometry.target,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: geometry.hairline,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  line: { color: colors.inkText, fontFamily: "Menlo", fontSize: type.data },
  fail: { color: colors.inkMute },
});
