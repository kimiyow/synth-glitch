import type { SFSymbol } from "expo-symbols";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ToolButtonId } from "../../editor/panels";
import { ToolModule } from "../kit/ToolModule";
import { colors } from "../tokens";
import { useLayout } from "../useLayout";

const BUTTONS: { id: ToolButtonId; label: string; icon: SFSymbol }[] = [
  { id: "brush", label: "Pincel", icon: "paintbrush.pointed" },
  { id: "effects", label: "Efectos", icon: "wand.and.stars" },
  { id: "mod", label: "Mod", icon: "waveform.path" },
  { id: "gyro", label: "Giro", icon: "gyroscope" },
  { id: "presets", label: "Presets", icon: "square.stack.3d.up" },
  { id: "gesture", label: "Gesto", icon: "hand.draw" },
];

type Props = {
  /** Herramienta activa (se conserva al cerrar el panel). */
  activeTool: "brush" | "effects";
  openPanel: string | null;
  disabled: Partial<Record<ToolButtonId, boolean>>;
  onPress: (id: ToolButtonId) => void;
  /** iPad (4.4): riel vertical a la izquierda en lugar de la barra inferior. */
  rail?: boolean;
};

/** Barra de herramientas modular: sustituye a las pestañas mientras hay un proyecto abierto. */
export function EditorToolbar({ activeTool, openPanel, disabled, onPress, rail = false }: Props) {
  const insets = useSafeAreaInsets();
  const { sideInset } = useLayout();
  return (
    <View
      style={
        rail
          ? [styles.rail, { paddingBottom: insets.bottom, paddingLeft: Math.max(insets.left, 8) }]
          : [styles.root, { paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: sideInset }]
      }
    >
      {BUTTONS.map(({ id, label, icon }) => (
        <ToolModule
          key={id}
          icon={icon}
          label={label}
          active={id === activeTool || id === openPanel}
          disabled={disabled[id] === true}
          onPress={() => onPress(id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    paddingTop: 64,
    paddingRight: 8,
    gap: 18,
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRightColor: colors.inkLine,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  root: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
    backgroundColor: colors.ink,
    borderTopColor: colors.inkLine,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
