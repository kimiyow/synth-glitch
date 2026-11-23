import type { SFSymbol } from "expo-symbols";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ToolButtonId } from "./panels";
import { ToolModule } from "../kit/ToolModule";
import { colors } from "../tokens";
import { useLayout } from "../useLayout";

const BUTTONS: { id: ToolButtonId; label: string; icon: SFSymbol }[] = [
  { id: "brush", label: "Pincel", icon: "paintbrush.pointed" },
  { id: "effects", label: "Efectos", icon: "wand.and.stars" },
  { id: "layers", label: "Capas", icon: "square.3.layers.3d" },
  { id: "mod", label: "Modulación", icon: "waveform.path" },
  { id: "presets", label: "Escenas", icon: "square.stack.3d.up" },
];

type Props = {
  // el único botón marcado (lo decide la pantalla: panel abierto o herramienta del dedo), o ninguno
  highlighted: ToolButtonId | null;
  disabled: Partial<Record<ToolButtonId, boolean>>;
  onPress: (id: ToolButtonId) => void;
};

// barra de herramientas modular: cada botón es un interruptor (el marcado se apaga al tocarlo)
export function EditorToolbar({ highlighted, disabled, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const { sideInset } = useLayout();
  return (
    <View
      // iPad (vertical y horizontal): las herramientas se agrupan centradas en el ancho de los paneles
      style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: sideInset }]}
    >
      {BUTTONS.map(({ id, label, icon }) => (
        <ToolModule
          key={id}
          icon={icon}
          label={label}
          active={id === highlighted}
          disabled={disabled[id] === true}
          onPress={() => onPress(id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
    backgroundColor: colors.ink,
    borderTopColor: colors.inkLine,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
