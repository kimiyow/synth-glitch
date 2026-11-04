import type { SFSymbol } from "expo-symbols";
import { Pressable, StyleSheet, Text } from "react-native";

import { tapFeedback } from "../../platform/haptics";
import { colors, radius, type } from "../tokens";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";

/** Botón modular: primario = blanco con texto negro; secundario = superficie gris; fantasma = solo texto. */
export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled = false,
  surface = "ink",
}: {
  label: string;
  onPress: () => void;
  icon?: SFSymbol;
  variant?: Variant;
  disabled?: boolean;
  /** Sobre superficie Papel (blanca) el primario se invierte a negro. */
  surface?: "ink" | "paper";
}) {
  const primaryOnPaper = variant === "primary" && surface === "paper";
  const fg =
    variant === "primary" ? (primaryOnPaper ? colors.paper : colors.paperText) : surface === "paper" ? colors.paperText : colors.inkText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.root,
        variant === "primary" && (primaryOnPaper ? styles.primaryPaper : styles.primary),
        variant === "secondary" && styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={fg} />}
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primary: { backgroundColor: colors.paper },
  primaryPaper: { backgroundColor: colors.paperText },
  secondary: { backgroundColor: colors.inkRaised },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  text: { fontFamily: type.family, fontSize: type.body, fontWeight: "600" },
});
