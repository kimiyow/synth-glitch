import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { SaveStatus } from "../../project/autosave";
import { colors, geometry, type } from "../tokens";

type Props = {
  name: string;
  readOnly: boolean;
  status: SaveStatus;
  onRename: (name: string) => boolean;
  onSaveProject: () => void;
};

const ROWS = [
  { icon: "⤓", label: "Guardar como jpg", milestone: "M10" },
  { icon: "GIF", label: "Guardar como GIF", milestone: "M10" },
  { icon: "▭", label: "Guardar proyecto", milestone: null },
  { icon: "▭", label: "Guardar preset gestual", milestone: "M7" },
] as const;

/** Panel Exportar del Figma (3.11): nombre editable, estado de autoguardado y salidas. */
export function ExportPanel({ name, readOnly, status, onRename, onSaveProject }: Props) {
  const [draft, setDraft] = useState(name);
  const [savedNote, setSavedNote] = useState(false);
  const statusText =
    readOnly ? "Solo lectura"
    : status.state === "error" ? `Error al guardar · ${status.error}`
    : status.state === "saved" ? (savedNote ? "Proyecto guardado" : "Cambios guardados")
    : "Guardando cambios…";

  return (
    <View>
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
        <Text style={styles.pencil}>✎</Text>
      </View>
      <Text style={styles.status}>{statusText}</Text>
      <View style={styles.rows}>
        {ROWS.map((row) => {
          const pending = row.milestone !== null;
          return (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              disabled={pending || readOnly}
              onPress={() => {
                onSaveProject();
                setSavedNote(true);
              }}
              style={[styles.row, (pending || readOnly) && styles.disabled]}
            >
              <Text style={styles.rowIcon}>{row.icon}</Text>
              <Text style={styles.rowLabel}>{row.label}</Text>
              {pending && <Text style={styles.pending}>{row.milestone}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.title, paddingVertical: 4 },
  pencil: { color: colors.inkText, fontSize: 18 },
  status: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, marginBottom: 16 },
  rows: { marginBottom: 8 },
  row: {
    minHeight: geometry.target,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomColor: colors.inkLineStrong,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.5 },
  rowIcon: { width: 28, color: colors.inkText, fontFamily: type.family, fontSize: type.label, textAlign: "center" },
  rowLabel: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.body },
  pending: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro },
});
