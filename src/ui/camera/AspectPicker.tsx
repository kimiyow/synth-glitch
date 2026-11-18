import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { selectFeedback } from "../../platform/haptics";
import { CAMERA_ASPECTS, type CameraAspect } from "../../state/settings";
import { colors, radius, type } from "../tokens";

// selector de relación sobre el visor: cápsula translúcida, la opción activa invertida
export function AspectPicker({ aspect, disabled, onSelect }: { aspect: CameraAspect; disabled: boolean; onSelect: (a: CameraAspect) => void }) {
  return (
    <View style={[styles.root, disabled && styles.disabled]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      {CAMERA_ASPECTS.map((a) => {
        const on = a === aspect;
        return (
          <Pressable
            key={a}
            accessibilityRole="button"
            accessibilityLabel={`Relación ${a}`}
            accessibilityState={{ selected: on, disabled }}
            disabled={disabled}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={() => {
              if (on) return;
              selectFeedback();
              onSelect(a);
            }}
            style={[styles.item, on && styles.itemOn]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{a}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    padding: 3,
    gap: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.scrimSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inkLineStrong,
  },
  disabled: { opacity: 0.4 },
  item: { minWidth: 48, minHeight: 28, paddingHorizontal: 10, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  itemOn: { backgroundColor: colors.paper },
  text: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, letterSpacing: 0.8 },
  textOn: { color: colors.paperText, fontWeight: "600" },
});
