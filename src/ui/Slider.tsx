import { useContext, useRef, useState } from "react";
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

import type { SFSymbol } from "expo-symbols";

import { Icon } from "./kit/Icon";
import { SheetScrollLock } from "./kit/Sheet";
import { colors, type } from "./tokens";

type Props = {
  label: string;
  // 0-1
  value: number;
  onChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingEnd?: () => void;
  // texto del valor a la derecha (por defecto, porcentaje)
  valueText?: string;
  // icono antes del nombre (p. ej. modulado o bloqueado por una modulación)
  badge?: SFSymbol;
};

const THUMB = 18;
// movimiento (pt) que decide si el dedo arrastra el deslizador (horizontal) o desplaza la hoja
const INTENT_SLOP = 6;

// deslizador moderno: pista fina, perilla blanca y valor a la derecha (responder de RN). No cambia
// el valor hasta saber la intención: un arrastre horizontal lo ajusta; uno vertical se cede a la
// hoja (scroll) sin tocar el valor; un toque sin arrastre salta al punto tocado al soltar
export function Slider({ label, value, onChange, onSlidingStart, onSlidingEnd, valueText, badge }: Props) {
  const [width, setWidth] = useState(1);
  const [active, setActive] = useState(false);
  // la perilla sigue al dedo con su propio estado; el padre puede tardar en actualizar value
  const [drag, setDrag] = useState<number | null>(null);
  const lockSheet = useContext(SheetScrollLock);
  // inicio del toque y si ya se decidió que es un arrastre del deslizador
  const touch = useRef({ x: 0, y: 0, engaged: false, cancelled: false });
  const valueAt = (e: GestureResponderEvent) =>
    Math.min(1, Math.max(0, (e.nativeEvent.locationX - THUMB / 2) / Math.max(1, width - THUMB)));
  const update = (e: GestureResponderEvent) => {
    const next = valueAt(e);
    setDrag(next);
    onChange(next);
  };
  const engage = (e: GestureResponderEvent) => {
    touch.current.engaged = true;
    setActive(true);
    lockSheet(true);
    onSlidingStart?.();
    update(e);
  };
  const end = () => {
    const wasEngaged = touch.current.engaged;
    touch.current.engaged = false;
    setActive(false);
    setDrag(null);
    lockSheet(false);
    if (wasEngaged) onSlidingEnd?.();
  };
  const v = Math.min(1, Math.max(0, drag ?? value));
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          {badge && <Icon name={badge} size={11} color={colors.inkText} />}
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={[styles.value, active && styles.valueOn]}>{valueText ?? `${Math.round(v * 100)}`}</Text>
      </View>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100), text: valueText }}
        // VoiceOver: deslizar arriba o abajo sube o baja un 5 % (un cambio completo cada vez)
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          const step = e.nativeEvent.actionName === "increment" ? 0.05 : e.nativeEvent.actionName === "decrement" ? -0.05 : 0;
          if (step === 0) return;
          onSlidingStart?.();
          onChange(Math.min(1, Math.max(0, value + step)));
          onSlidingEnd?.();
        }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // mientras no arrastra, la hoja puede quedarse con el toque para desplazarse
        onResponderTerminationRequest={() => !touch.current.engaged}
        onResponderGrant={(e) => {
          touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, engaged: false, cancelled: false };
        }}
        onResponderMove={(e) => {
          const t = touch.current;
          if (t.cancelled) return;
          if (t.engaged) return update(e);
          const dx = Math.abs(e.nativeEvent.pageX - t.x);
          const dy = Math.abs(e.nativeEvent.pageY - t.y);
          if (dy > INTENT_SLOP && dy > dx) t.cancelled = true;
          else if (dx > INTENT_SLOP) engage(e);
        }}
        onResponderRelease={(e) => {
          const t = touch.current;
          // toque sin arrastre: salta al punto tocado (un cambio completo)
          if (!t.engaged && !t.cancelled) {
            onSlidingStart?.();
            onChange(valueAt(e));
            onSlidingEnd?.();
            return;
          }
          end();
        }}
        onResponderTerminate={end}
        style={styles.hit}
      >
        {/* sin toques en los hijos: así locationX siempre es relativo a la pista y la perilla no
            salta cuando el dedo pasa por encima de ella */}
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.fill, { width: `${v * 100}%` }]} />
        </View>
        <View pointerEvents="none" style={[styles.thumb, active && styles.thumbOn, { left: v * Math.max(0, width - THUMB) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  labelRow: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  label: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  value: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, fontVariant: ["tabular-nums"] },
  valueOn: { color: colors.inkText },
  hit: { height: 36, justifyContent: "center" },
  track: { height: 3, marginHorizontal: THUMB / 2, borderRadius: 2, backgroundColor: colors.inkRaised, overflow: "hidden" },
  fill: { height: 3, backgroundColor: colors.inkText },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.paper,
  },
  thumbOn: { transform: [{ scale: 1.2 }] },
});
