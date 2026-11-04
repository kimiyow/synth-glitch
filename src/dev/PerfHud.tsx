import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, type } from "../ui/tokens";
import {
  addFrame,
  emptyFrameWindow,
  FRAME_WINDOW_MS,
  summarizeIfDue,
  type FrameSummary,
} from "./frameWindow";

/**
 * HUD de rendimiento (desarrollo o EXPO_PUBLIC_DEV_TOOLS=1).
 * Hilo de UI: useFrameCallback solo suma números en valores compartidos (sin objetos,
 * sin llamadas a otros módulos ni a JS). Hilo de JS: los lee cada 500 ms.
 * Toque: plegar o desplegar. Mantener: abrir testLab.
 */
export function PerfHud() {
  const insets = useSafeAreaInsets();
  const ui = useUiFrameSummary();
  const js = useJsFrameSummary();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Pressable
      accessibilityLabel="Monitor de rendimiento"
      onPress={() => setCollapsed((c) => !c)}
      onLongPress={() => router.push("/test-lab")}
      style={[styles.root, { top: insets.top + 4 }]}
      hitSlop={8}
    >
      {collapsed ? (
        <Text style={styles.text}>{formatFps(ui)}</Text>
      ) : (
        <>
          <Text style={styles.text}>UI {formatLine(ui)}</Text>
          <Text style={styles.text}>JS {formatLine(js)}</Text>
        </>
      )}
    </Pressable>
  );
}

function useUiFrameSummary() {
  const [summary, setSummary] = useState<FrameSummary | null>(null);
  // Contadores que solo crecen; JS calcula la diferencia entre lecturas.
  const totalFrames = useSharedValue(0);
  const totalMs = useSharedValue(0);
  const maxMs = useSharedValue(0);

  useFrameCallback((info) => {
    const frameMs = info.timeSincePreviousFrame;
    if (frameMs == null) return;
    totalFrames.set(totalFrames.get() + 1);
    totalMs.set(totalMs.get() + frameMs);
    if (frameMs > maxMs.get()) maxMs.set(frameMs);
  });

  useEffect(() => {
    let lastFrames = totalFrames.get();
    let lastMs = totalMs.get();
    let lastAt = performance.now();
    const id = setInterval(() => {
      const frames = totalFrames.get();
      const ms = totalMs.get();
      const now = performance.now();
      const df = frames - lastFrames;
      if (df > 0) {
        setSummary({
          fps: (df * 1000) / (now - lastAt),
          avgMs: (ms - lastMs) / df,
          maxMs: maxMs.get(),
        });
      }
      maxMs.set(0);
      lastFrames = frames;
      lastMs = ms;
      lastAt = now;
    }, FRAME_WINDOW_MS);
    return () => clearInterval(id);
  }, [totalFrames, totalMs, maxMs]);

  return summary;
}

function useJsFrameSummary() {
  const [summary, setSummary] = useState<FrameSummary | null>(null);

  useEffect(() => {
    let raf = 0;
    let last: number | null = null;
    let window = emptyFrameWindow(performance.now());
    const tick = (now: number) => {
      if (last != null) {
        window = addFrame(window, now - last);
        const s = summarizeIfDue(window, now);
        if (s) {
          setSummary(s);
          window = emptyFrameWindow(now);
        }
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return summary;
}

function formatFps(s: FrameSummary | null) {
  return s ? `${Math.round(s.fps)}` : "--";
}

function formatLine(s: FrameSummary | null) {
  if (!s) return "-- fps";
  return `${formatFps(s)} fps · ${s.avgMs.toFixed(1)} / ${s.maxMs.toFixed(1)} ms`;
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: 4,
    zIndex: 1000,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.inkSurface,
    borderColor: colors.inkLine,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    color: colors.inkText,
    fontFamily: "Menlo",
    fontSize: type.micro,
  },
});
