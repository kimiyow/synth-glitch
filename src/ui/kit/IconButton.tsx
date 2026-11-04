import type { SFSymbol } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import { tapFeedback } from "../../platform/haptics";
import { colors } from "../tokens";
import { Icon } from "./Icon";

type Props = {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Resaltado invertido (blanco con icono negro). */
  active?: boolean;
  /** Sin fondo (p. ej. sobre la cámara). */
  bare?: boolean;
  /** Punto indicador (p. ej. autoguardado). */
  dot?: boolean;
  size?: number;
};

/** Botón circular de icono (barra superior, cabeceras). EDT-04: deshabilitado al 50 %. */
export function IconButton({ icon, label, onPress, disabled = false, active = false, bare = false, dot = false, size = 40 }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.root,
        { width: size, height: size, borderRadius: size / 2 },
        !bare && styles.filled,
        active && styles.active,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={icon} size={size * 0.48} color={active ? colors.paperText : colors.inkText} />
      {dot && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center" },
  filled: { backgroundColor: colors.inkRaised },
  active: { backgroundColor: colors.paper },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  disabled: { opacity: 0.5 },
  dot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.inkText,
    borderWidth: 1,
    borderColor: colors.ink,
  },
});
