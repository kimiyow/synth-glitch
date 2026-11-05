import { Pressable, StyleSheet, Text } from "react-native";

import { selectFeedback } from "../../platform/haptics";
import { colors, radius, type } from "../tokens";

/** Chip en forma de pastilla; seleccionado = invertido (blanco con texto negro). */
export function Pill({
  label,
  selected = false,
  disabled = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      // 30 pt visibles + 7 arriba y abajo = 44 pt de zona táctil (NFR-13).
      hitSlop={{ top: 7, bottom: 7 }}
      onPress={() => {
        selectFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.root, selected && styles.on, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.text, selected && styles.textOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 12,
    minHeight: 30,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.inkRaised,
  },
  on: { backgroundColor: colors.paper },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  text: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, letterSpacing: 0.6 },
  textOn: { color: colors.paperText, fontWeight: "600" },
});
