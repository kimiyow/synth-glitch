import type { SFSymbol } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { selectFeedback } from "../../platform/haptics";
import { colors, radius, type } from "../tokens";
import { Icon } from "./Icon";

type Props = {
  icon: SFSymbol;
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** Módulo de herramienta (icono + etiqueta). Lo activo se invierte en una pastilla blanca. */
export function ToolModule({ icon, label, active, disabled = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      onPress={() => {
        selectFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.root, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={[styles.pill, active && styles.pillOn]}>
        <Icon name={icon} size={20} color={active ? colors.paperText : colors.inkText} />
      </View>
      <Text style={[styles.label, active && styles.labelOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", gap: 4, minWidth: 60, minHeight: 44 },
  disabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.95 }] },
  pill: { width: 48, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: colors.paper },
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label },
  labelOn: { color: colors.inkText, fontWeight: "600" },
});
