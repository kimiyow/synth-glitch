import type { SFSymbol } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { tapFeedback } from "../../platform/haptics";
import type { SaveStatus } from "../../project/autosave";
import { Icon } from "../kit/Icon";
import { colors, radius, space, type } from "../tokens";

type Props = {
  name: string;
  readOnly: boolean;
  status: SaveStatus;
  onRename: (name: string) => boolean;
  onSaveProject: () => void;
};

const ROWS: { icon: SFSymbol; label: string; milestone: string | null }[] = [
  { icon: "photo", label: "Guardar como JPG", milestone: "M10" },
  { icon: "sparkles.rectangle.stack", label: "Guardar como GIF", milestone: "M10" },
  { icon: "folder", label: "Guardar proyecto", milestone: null },
  { icon: "hand.draw", label: "Guardar preset gestual", milestone: "M7" },
];

/** Panel Exportar (3.11): nombre editable, estado de autoguardado y salidas en módulos. */
export function ExportPanel({ name, readOnly, status, onRename, onSaveProject }: Props) {
  const [draft, setDraft] = useState(name);
  const [savedNote, setSavedNote] = useState(false);
  const statusText = readOnly
    ? "Solo lectura"
    : status.state === "error"
      ? `Error al guardar · ${status.error}`
      : status.state === "saved"
        ? savedNote
          ? "Proyecto guardado"
          : "Cambios guardados"
        : "Guardando cambios…";

  return (
    <View style={styles.root}>
      <View style={styles.nameRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onEndEditing={() => {
            if (!onRename(draft)) setDraft(name);
          }}
          editable={!readOnly}
          maxLength={40}
          returnKeyType="done"
          accessibilityLabel="Nombre del proyecto"
          style={styles.name}
        />
        <Icon name="pencil" size={16} color={colors.inkMute} />
      </View>
      <Text style={styles.status}>{statusText}</Text>
      <View style={styles.grid}>
        {ROWS.map((row) => {
          const off = row.milestone !== null || readOnly;
          return (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: off }}
              disabled={off}
              onPress={() => {
                tapFeedback();
                onSaveProject();
                setSavedNote(true);
              }}
              style={({ pressed }) => [styles.module, off && styles.off, pressed && styles.pressed]}
            >
              <Icon name={row.icon} size={22} />
              <Text style={styles.moduleLabel}>{row.label}</Text>
              {row.milestone && <Text style={styles.pending}>{row.milestone}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.title, fontWeight: "600", paddingVertical: 2 },
  status: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, marginBottom: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  module: {
    width: "48.5%",
    minHeight: 76,
    padding: space.md,
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
  },
  off: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  moduleLabel: { color: colors.inkText, fontFamily: type.family, fontSize: type.label + 1 },
  pending: { position: "absolute", top: space.sm, right: space.sm, color: colors.inkMute, fontFamily: type.family, fontSize: type.micro },
});
