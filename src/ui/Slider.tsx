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
};

/** Deslizador con el aspecto de barra del Figma (responder de RN, sin librerías). */
export function Slider({ label, value, onChange, onSlidingStart, onSlidingEnd }: Props) {
  const [width, setWidth] = useState(1);
  const update = (e: GestureResponderEvent) => {
    onChange(Math.min(1, Math.max(0, e.nativeEvent.locationX / width)));
  };
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          onSlidingStart?.();
          update(e);
        }}
        onResponderMove={update}
        onResponderRelease={() => onSlidingEnd?.()}
        onResponderTerminate={() => onSlidingEnd?.()}
        style={styles.hit}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${value * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 2 },
  label: { color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  hit: { height: 32, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, backgroundColor: "#3A3A3A", overflow: "hidden" },
  fill: { height: 4, backgroundColor: colors.inkText },
});
