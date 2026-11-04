import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { colors, type } from "../ui/tokens";
import {
  addFrame,
  emptyFrameWindow,
  summarizeIfDue,
  type FrameSummary,
} from "./frameWindow";

/**
 * HUD de rendimiento (solo desarrollo). Mide el hilo de UI con useFrameCallback y
 * el de JS con requestAnimationFrame; solo hay un setState cada 500 ms.
 * Toque: plegar o desplegar. Mantener: abrir testLab.
 */
export function PerfHud() {
  const insets = useSafeAreaInsets();
  const [ui, setUi] = useState<FrameSummary | null>(null);
  const js = useJsFrameSummary();
  const [collapsed, setCollapsed] = useState(false);

  const uiWindow = useSharedValue(emptyFrameWindow(0));
  useFrameCallback((info) => {
    const frameMs = info.timeSincePreviousFrame;
    if (frameMs == null) {
      uiWindow.value = emptyFrameWindow(info.timestamp);
      return;
    }
    const next = addFrame(uiWindow.value, frameMs);
    const summary = summarizeIfDue(next, info.timestamp);
    if (summary) {
      uiWindow.value = emptyFrameWindow(info.timestamp);
      scheduleOnRN(setUi, summary);
    } else {
      uiWindow.value = next;
    }
  });

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
