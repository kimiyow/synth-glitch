import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ToolButtonId } from "../../editor/panels";
import { colors, type } from "../tokens";

const BUTTONS: { id: ToolButtonId; label: string }[] = [
  { id: "brush", label: "Pincel" },
  { id: "effects", label: "Efectos" },
  { id: "gyro", label: "Giro" },
  { id: "presets", label: "Presets" },
  { id: "gesture", label: "Gesto" },
];

type Props = {
  /** Herramienta activa (cuadro gris del Figma). */
  activeTool: "brush" | "effects";
  openPanel: string | null;
  disabled: Partial<Record<ToolButtonId, boolean>>;
  onPress: (id: ToolButtonId) => void;
};

/** Barra inferior del Editor (4.1): sustituye a las pestañas mientras hay un proyecto abierto. */
export function EditorToolbar({ activeTool, openPanel, disabled, onPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {BUTTONS.map(({ id, label }) => {
        const highlighted = id === activeTool || id === openPanel;
        const off = disabled[id] === true;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: highlighted, disabled: off }}
            onPress={() => onPress(id)}
            style={[styles.button, off && styles.disabled]}
          >
            <View style={[styles.marker, highlighted && styles.markerOn]}>
              <Text style={[styles.triangle, highlighted && styles.textOn]}>▼</Text>
            </View>
            <Text style={[styles.label, highlighted && styles.textOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", justifyContent: "space-around", paddingTop: 6, backgroundColor: colors.ink },
  button: { alignItems: "center", minWidth: 56, minHeight: 44 },
  disabled: { opacity: 0.5 },
  marker: { width: 30, height: 30, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  markerOn: { backgroundColor: "#3A3A3A" },
  triangle: { color: colors.inkMute, fontSize: 12 },
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body - 1 },
  textOn: { color: colors.inkText },
});
