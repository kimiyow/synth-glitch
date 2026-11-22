import { Pressable, StyleSheet, Text, View } from "react-native";

import { tapFeedback } from "../../platform/haptics";
import { IconButton } from "../kit/IconButton";
import { Icon } from "../kit/Icon";
import { colors, COMPACT_FONT_SCALE, radius, space, type } from "../tokens";

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  // hay cambios sin guardar (punto sobre Exportar)
  unsaved: boolean;
  exportOpen: boolean;
  stageOpen: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  // panel del modo escenario
  onStage: () => void;
  // menú ⋯ (ver introducción)
  onMore: () => void;
};

// barra superior: volver · deshacer/rehacer agrupados (50 % si no aplican) · ⋯ · escenario ·
// Exportar como única acción principal (blanca, con punto de cambios sin guardar)
export function EditorTopBar({ canUndo, canRedo, unsaved, exportOpen, stageOpen, onBack, onUndo, onRedo, onExport, onStage, onMore }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.side}>
        <IconButton icon="chevron.left" label="Volver" bare onPress={onBack} />
        <View style={styles.group}>
          <IconButton icon="arrow.uturn.backward" label="Deshacer" bare size={36} disabled={!canUndo} onPress={onUndo} />
          <View style={styles.divider} />
          <IconButton icon="arrow.uturn.forward" label="Rehacer" bare size={36} disabled={!canRedo} onPress={onRedo} />
        </View>
      </View>
      <View style={styles.side}>
        <IconButton icon="ellipsis" label="Más opciones" bare onPress={onMore} />
        <IconButton icon="play.rectangle" label="Modo escenario" bare active={stageOpen} onPress={onStage} />
        <ExportButton open={exportOpen} unsaved={unsaved} onPress={onExport} />
      </View>
    </View>
  );
}

function ExportButton({ open, unsaved, onPress }: { open: boolean; unsaved: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unsaved ? "Exportar. Hay cambios sin guardar" : "Exportar"}
      accessibilityState={{ selected: open }}
      hitSlop={6}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.export, open && styles.exportOpen, pressed && styles.pressed]}
    >
      <Text style={[styles.exportText, open && styles.exportTextOpen]} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
        Exportar
      </Text>
      {unsaved ? (
        <View style={[styles.dot, open && styles.dotOpen]} />
      ) : (
        <Icon name="square.and.arrow.up" size={14} color={open ? colors.inkText : colors.paperText} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
  },
  side: { flexDirection: "row", alignItems: "center", gap: space.xs },
  group: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.inkRaised,
  },
  divider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.inkLineStrong },
  export: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    marginLeft: space.xs,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
  },
  // abierto: se invierte a contorno para que se lea como "este panel está abierto"
  exportOpen: { backgroundColor: colors.inkRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.inkLineStrong },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  exportText: { color: colors.paperText, fontFamily: type.family, fontSize: type.body - 1, fontWeight: "600" },
  exportTextOpen: { color: colors.inkText },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.paperText },
  dotOpen: { backgroundColor: colors.inkText },
});
