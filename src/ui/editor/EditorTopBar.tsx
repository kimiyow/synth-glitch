import { StyleSheet, View } from "react-native";

import { IconButton } from "../kit/IconButton";
import { space } from "../tokens";

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  /** Hay cambios sin guardar (punto sobre Exportar). */
  unsaved: boolean;
  exportOpen: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  /** Menú ⋯ (modo escenario, 3.12). */
  onMore: () => void;
};

/** Barra superior: volver · deshacer/rehacer (50 % si no aplican, EDT-04) · exportar con punto de cambios sin guardar. */
export function EditorTopBar({ canUndo, canRedo, unsaved, exportOpen, onBack, onUndo, onRedo, onExport, onMore }: Props) {
  return (
    <View style={styles.root}>
      <IconButton icon="chevron.left" label="Volver" onPress={onBack} />
      <View style={styles.center}>
        <IconButton icon="arrow.uturn.backward" label="Deshacer" disabled={!canUndo} onPress={onUndo} />
        <IconButton icon="arrow.uturn.forward" label="Rehacer" disabled={!canRedo} onPress={onRedo} />
      </View>
      <View style={styles.center}>
        <IconButton icon="ellipsis" label="Más opciones" onPress={onMore} />
        <IconButton icon="square.and.arrow.up" label="Exportar" active={exportOpen} dot={unsaved} onPress={onExport} />
      </View>
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
