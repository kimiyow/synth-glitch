import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";

import { GESTURE_MAX_FRAMES, GESTURE_MAX_S, GESTURE_RATE_HZ } from "../modulation/sources";
import { Icon } from "../ui/kit/Icon";
import { colors, radius, space, type } from "../ui/tokens";
import type { ModBus } from "./modBus";

type Props = {
  bus: ModBus;
  // modulación GESTO que se graba
  routeId: string;
  // nombres de los ejes de la capa, para explicar qué mueve cada dirección del dedo
  axes: { x: string; y: string };
  // fin de la grabación: muestras [x, y] intercaladas y duración (ms)
  onDone: (clip: { durationMs: number; samples: number[] }) => void;
  onCancel: () => void;
};

// cada cuánto mira JS si la grabación terminó (y actualiza el contador)
const POLL_MS = 100;

// capa de grabación sobre el lienzo: la posición del dedo en el área de la imagen es el valor de
// los dos parámetros (izquierda → derecha = 0 → 1; abajo → arriba = 0 → 1). Todo ocurre en el hilo
// de UI; JS solo consulta números para saber cuándo terminó (sin llamar a JS desde un worklet)
export function GestureRecorder({ bus, routeId, axes, onDone, onCancel }: Props) {
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [elapsed, setElapsed] = useState<number | null>(null);
  const down = useSharedValue(0);
  const startAt = useSharedValue(-1);
  const samples = useSharedValue<number[]>([]);
  const done = useSharedValue(0);
  const seconds = useSharedValue(0);
  const finished = useRef(false);

  // al salir (terminar o cancelar) la ruta deja de seguir al dedo
  const { recRoute } = bus;
  useEffect(() => () => recRoute.set(""), [recRoute]);

  const w = size.w;
  const h = size.h;
  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(0)
    .onBegin((e) => {
      if (done.get() === 1) return;
      bus.recX.set(Math.min(1, Math.max(0, e.x / w)));
      bus.recY.set(Math.min(1, Math.max(0, 1 - e.y / h)));
      bus.recRoute.set(routeId);
      if (startAt.get() < 0) startAt.set(bus.time.get());
      down.set(1);
    })
    .onUpdate((e) => {
      bus.recX.set(Math.min(1, Math.max(0, e.x / w)));
      bus.recY.set(Math.min(1, Math.max(0, 1 - e.y / h)));
    })
    .onFinalize(() => {
      down.set(0);
      // soltar el dedo termina la grabación
      if (startAt.get() >= 0) done.set(1);
    });

  // muestreo a 30 Hz con la posición actual (también si el dedo queda quieto)
  useFrameCallback(() => {
    if (down.get() !== 1 || done.get() === 1 || startAt.get() < 0) return;
    const t = bus.time.get() - startAt.get();
    seconds.set(t);
    const target = Math.min(GESTURE_MAX_FRAMES, Math.floor(t * GESTURE_RATE_HZ) + 1);
    const cur = samples.get();
    if (cur.length / 2 < target) {
      const next = cur.slice();
      while (next.length / 2 < target) next.push(bus.recX.get(), bus.recY.get());
      samples.set(next);
    }
    if (t >= GESTURE_MAX_S) done.set(1);
  });

  useEffect(() => {
    const id = setInterval(() => {
      if (finished.current) return;
      if (startAt.get() >= 0) setElapsed(seconds.get());
      if (done.get() !== 1) return;
      finished.current = true;
      const s = samples.get();
      onDone({ durationMs: Math.round(((s.length / 2) * 1000) / GESTURE_RATE_HZ), samples: s.slice() });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [done, samples, seconds, startAt, onDone]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: Math.max(1, e.nativeEvent.layout.width), h: Math.max(1, e.nativeEvent.layout.height) });
  const shown = elapsed ?? 0;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <GestureDetector gesture={pan}>
        <View style={styles.pad} accessible accessibilityLabel="Área de grabación del gesto" />
      </GestureDetector>
      <View style={styles.top} pointerEvents="box-none">
        <View style={[styles.badge, elapsed !== null && styles.badgeRec]} pointerEvents="none">
          {elapsed !== null && <View style={styles.dot} />}
          <Text style={[styles.badgeText, elapsed !== null && styles.badgeTextRec]}>
            {elapsed === null ? "LISTO PARA GRABAR" : `REC 0:${String(Math.floor(shown)).padStart(2, "0")} / 0:${GESTURE_MAX_S}`}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancelar grabación" hitSlop={8} onPress={onCancel} style={styles.cancel}>
          <Icon name="xmark" size={14} />
        </Pressable>
      </View>
      {/* qué hacer: antes de tocar, qué mueve cada dirección; grabando, cómo terminar */}
      <View style={styles.guide} pointerEvents="none">
        {elapsed === null ? (
          <>
            <Text style={styles.guideTitle}>Toca y mueve el dedo sobre la imagen</Text>
            <View style={styles.guideRow}>
              <Icon name="arrow.left.and.right" size={13} />
              <Text style={styles.guideText}>{axes.x}</Text>
              <View style={styles.guideSep} />
              <Icon name="arrow.up.and.down" size={13} />
              <Text style={styles.guideText}>{axes.y}</Text>
            </View>
            <Text style={styles.guideNote}>Al soltar, la capa repite tu movimiento en bucle</Text>
          </>
        ) : (
          <Text style={styles.guideNote}>Suelta para terminar · máximo {GESTURE_MAX_S} s</Text>
        )}
      </View>
      {elapsed !== null && (
        <View style={styles.progress} pointerEvents="none">
          <View style={[styles.progressFill, { width: `${Math.min(100, (shown / GESTURE_MAX_S) * 100)}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { ...StyleSheet.absoluteFill, borderRadius: 12, borderWidth: 1, borderColor: colors.inkLineStrong, borderStyle: "dashed" },
  top: { position: "absolute", top: space.sm, left: space.sm, right: space.sm, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 28,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  badgeRec: { backgroundColor: colors.paper },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.paperText },
  badgeText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1, fontVariant: ["tabular-nums"] },
  badgeTextRec: { color: colors.paperText, fontWeight: "700" },
  cancel: {
    position: "absolute",
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.scrim,
  },
  guide: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: space.xl,
    alignItems: "center",
    gap: 6,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.scrim,
    alignSelf: "center",
  },
  guideTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.body - 1, fontWeight: "600", textAlign: "center" },
  guideRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  guideSep: { width: StyleSheet.hairlineWidth, height: 12, marginHorizontal: 4, backgroundColor: colors.inkLineStrong },
  guideText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  guideNote: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, textAlign: "center" },
  progress: { position: "absolute", left: space.md, right: space.md, bottom: space.md, height: 3, borderRadius: 2, backgroundColor: colors.inkLineStrong, overflow: "hidden" },
  progressFill: { height: 3, backgroundColor: colors.paper },
});
