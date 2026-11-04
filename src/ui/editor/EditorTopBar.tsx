import { StyleSheet, View } from "react-native";

import { IconButton } from "../kit/IconButton";
import { space } from "../tokens";

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

/** Barra superior: volver · deshacer/rehacer (50 % si no aplican, EDT-04) · exportar con punto de autoguardado. */
export function EditorTopBar({ canUndo, canRedo, saving, exportOpen, onBack, onUndo, onRedo, onExport }: Props) {
  return (
    <View style={styles.root}>
      <IconButton icon="chevron.left" label="Volver" onPress={onBack} />
      <View style={styles.center}>
        <IconButton icon="arrow.uturn.backward" label="Deshacer" disabled={!canUndo} onPress={onUndo} />
        <IconButton icon="arrow.uturn.forward" label="Rehacer" disabled={!canRedo} onPress={onRedo} />
      </View>
      <IconButton icon="square.and.arrow.up" label="Exportar" active={exportOpen} dot={saving} onPress={onExport} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
  },
  center: { flexDirection: "row", gap: space.sm },
});
