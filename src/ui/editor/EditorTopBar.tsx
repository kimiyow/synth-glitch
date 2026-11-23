import { Pressable, StyleSheet, Text, View } from "react-native";

import { tapFeedback } from "../../platform/haptics";
import { IconButton } from "../kit/IconButton";
import { Icon } from "../kit/Icon";
import { colors, COMPACT_FONT_SCALE, radius, space, type } from "../tokens";

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  // hay cambios sin guardar: Guardar se enciende
  unsaved: boolean;
  // proyecto de solo lectura: sin Guardar
  readOnly: boolean;
  onSave: () => void;
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
// exportar · Guardar como acción principal: blanca con cambios sin guardar, atenuada («Guardado»)
// sin ellos. No hay autoguardado, así que guardar tiene su propio botón y no vive en Exportar
export function EditorTopBar(props: Props) {
  const { canUndo, canRedo, unsaved, readOnly, exportOpen, stageOpen, onBack, onUndo, onRedo, onExport, onStage, onMore, onSave } = props;
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
        <IconButton icon="square.and.arrow.up" label="Exportar" bare active={exportOpen} onPress={onExport} />
        {!readOnly && <SaveButton unsaved={unsaved} onPress={onSave} />}
      </View>
    </View>
  );
}

function SaveButton({ unsaved, onPress }: { unsaved: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unsaved ? "Guardar. Hay cambios sin guardar" : "Guardado"}
      accessibilityState={{ disabled: !unsaved }}
      disabled={!unsaved}
      hitSlop={6}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.save, !unsaved && styles.saveDone, pressed && styles.pressed]}
    >
      {!unsaved && <Icon name="checkmark" size={13} color={colors.inkMute} />}
      <Text style={[styles.saveText, !unsaved && styles.saveTextDone]} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
        {unsaved ? "Guardar" : "Guardado"}
      </Text>
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
  save: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    marginLeft: space.xs,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
  },
  // sin cambios: se apaga a contorno y dice «Guardado»
  saveDone: { backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.inkLine, paddingHorizontal: 12 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  saveText: { color: colors.paperText, fontFamily: type.family, fontSize: type.body - 1, fontWeight: "600" },
  saveTextDone: { color: colors.inkMute, fontWeight: "400" },
});
