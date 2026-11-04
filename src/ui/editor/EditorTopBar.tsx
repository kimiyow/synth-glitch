import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, geometry, type } from "../tokens";

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  exportOpen: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
};

/** Barra superior del Figma: volver · ↶ ↷ · exportar (EDT-04: siempre visibles, 50 % si no aplican). */
export function EditorTopBar({ canUndo, canRedo, saving, exportOpen, onBack, onUndo, onRedo, onExport }: Props) {
  return (
    <View style={styles.root}>
      <IconButton label="‹" a11y="Volver" onPress={onBack} />
      <View style={styles.center}>
        <IconButton label="↶" a11y="Deshacer" disabled={!canUndo} onPress={onUndo} />
        <IconButton label="↷" a11y="Rehacer" disabled={!canRedo} onPress={onRedo} />
      </View>
      <View>
        <IconButton label="⤓" a11y="Exportar" active={exportOpen} onPress={onExport} />
        {/* Indicador discreto de autoguardado (4.3). */}
        {saving && <View style={styles.savingDot} />}
      </View>
    </View>
  );
}

function IconButton({
  label,
  a11y,
  disabled = false,
  active = false,
  onPress,
}: {
  label: string;
  a11y: string;
  disabled?: boolean;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={[styles.icon, active && styles.active]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  center: { flexDirection: "row", gap: 16 },
  button: { width: geometry.target, height: geometry.target, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  icon: { color: colors.inkText, fontFamily: type.family, fontSize: 24 },
  active: { color: colors.inkMute },
  savingDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.inkText,
  },
});
