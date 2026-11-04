import type { SFSymbol } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { tapFeedback } from "../../platform/haptics";
import type { SaveStatus } from "../../state/sceneStore";
import { Icon } from "../kit/Icon";
import { colors, radius, space, type } from "../tokens";

export type ExportAction = "jpg" | "gif" | "project" | "gesture" | "share";

/** Exportación en curso (GIF): progreso 0-1 y cancelación (EXP-02). */
export type ExportJob = { label: string; progress: number | null; onCancel?: () => void };

type Props = {
  name: string;
  readOnly: boolean;
  status: SaveStatus;
  onRename: (name: string) => boolean;
  /** Proyecto recién creado que aún no se guarda. */
  draft: boolean;
  /** Motivo por el que una salida no está disponible (se muestra en el módulo), o null. */
  unavailable: Partial<Record<ExportAction, string>>;
  job: ExportJob | null;
  onAction: (action: ExportAction) => void;
};

const ROWS: { id: ExportAction; icon: SFSymbol; label: string }[] = [
  { id: "jpg", icon: "photo", label: "Guardar como JPG" },
  { id: "gif", icon: "sparkles.rectangle.stack", label: "Guardar como GIF" },
  { id: "project", icon: "folder", label: "Guardar proyecto" },
  { id: "share", icon: "square.and.arrow.up", label: "Compartir" },
  { id: "gesture", icon: "hand.draw", label: "Guardar preset gestual" },
];

/** Panel Exportar (3.11): nombre editable, estado del guardado manual y salidas en módulos. */
export function ExportPanel({ name, readOnly, status, draft: isDraft, unavailable, job, onRename, onAction }: Props) {
  const [draft, setDraft] = useState(name);
  const statusText = readOnly
    ? "Solo lectura"
    : status.state === "error"
      ? `Error al guardar · ${status.error}`
      : isDraft
        ? "Proyecto nuevo · sin guardar"
        : status.state === "unsaved"
          ? "Cambios sin guardar"
          : "Todo guardado";

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
      {job && (
        <View style={styles.job}>
          <View style={styles.jobHeader}>
            <Text style={styles.jobLabel}>{job.label}</Text>
            {job.onCancel && (
              <Pressable accessibilityRole="button" onPress={job.onCancel} hitSlop={8}>
                <Text style={styles.cancel}>CANCELAR</Text>
              </Pressable>
            )}
          </View>
          {job.progress !== null && (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(job.progress * 100)}%` }]} />
            </View>
          )}
        </View>
      )}
      <View style={styles.grid}>
        {ROWS.map((row) => {
          const reason = unavailable[row.id] ?? null;
          const off = reason !== null || job !== null;
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              accessibilityState={{ disabled: off }}
              disabled={off}
              onPress={() => {
                tapFeedback();
                onAction(row.id);
              }}
              style={({ pressed }) => [styles.module, off && styles.off, pressed && styles.pressed]}
            >
              <Icon name={row.icon} size={22} />
              <Text style={styles.moduleLabel}>{row.label}</Text>
              {reason && <Text style={styles.pending}>{reason}</Text>}
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
  job: { gap: 6, marginBottom: space.xs },
  jobHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  jobLabel: { color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  cancel: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600", letterSpacing: 1 },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.inkRaised, overflow: "hidden" },
  fill: { height: 3, backgroundColor: colors.inkText },
  pending: { position: "absolute", top: space.sm, right: space.sm, color: colors.inkMute, fontFamily: type.family, fontSize: type.micro },
});
