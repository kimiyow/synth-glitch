import { useState } from "react";
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

import { colors, type } from "./tokens";

type Props = {
  label: string;
  /** 0-1 */
  value: number;
  onChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingEnd?: () => void;
  /** Texto del valor a la derecha (por defecto, porcentaje). */
  valueText?: string;
};

const THUMB = 18;

/** Deslizador moderno: pista fina, perilla blanca y valor a la derecha (responder de RN). */
export function Slider({ label, value, onChange, onSlidingStart, onSlidingEnd, valueText }: Props) {
  const [width, setWidth] = useState(1);
  const [active, setActive] = useState(false);
  const update = (e: GestureResponderEvent) => {
    onChange(Math.min(1, Math.max(0, (e.nativeEvent.locationX - THUMB / 2) / Math.max(1, width - THUMB))));
  };
  const v = Math.min(1, Math.max(0, value));
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.value, active && styles.valueOn]}>{valueText ?? `${Math.round(v * 100)}`}</Text>
      </View>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          setActive(true);
          onSlidingStart?.();
          update(e);
        }}
        onResponderMove={update}
        onResponderRelease={() => {
          setActive(false);
          onSlidingEnd?.();
        }}
        onResponderTerminate={() => {
          setActive(false);
          onSlidingEnd?.();
        }}
        style={styles.hit}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${v * 100}%` }]} />
        </View>
        <View style={[styles.thumb, active && styles.thumbOn, { left: v * Math.max(0, width - THUMB) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  label: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  value: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, fontVariant: ["tabular-nums"] },
  valueOn: { color: colors.inkText },
  hit: { height: 32, justifyContent: "center" },
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
