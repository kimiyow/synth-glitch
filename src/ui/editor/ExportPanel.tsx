import type { SFSymbol } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { SaveStatus } from "../../state/sceneStore";
import { useRevealOnFocus } from "../kit/Sheet";
import { ActionGrid } from "../kit/ActionGrid";
import { Icon } from "../kit/Icon";
import { colors, space, type } from "../tokens";

export type ExportAction = "jpg" | "gif" | "project" | "gesture" | "share";

// exportación en curso (GIF): progreso 0-1 y cancelación
export type ExportJob = { label: string; progress: number | null; onCancel?: () => void };

type Props = {
  name: string;
  readOnly: boolean;
  status: SaveStatus;
  onRename: (name: string) => boolean;
  // proyecto recién creado que aún no se guarda
  draft: boolean;
  // motivo por el que una salida no está disponible (se muestra en el módulo), o null
  unavailable: Partial<Record<ExportAction, string>>;
  job: ExportJob | null;
  onAction: (action: ExportAction) => void;
};

const ROWS: { id: ExportAction; icon: SFSymbol; label: string }[] = [
  { id: "jpg", icon: "photo", label: "JPG" },
  { id: "gif", icon: "sparkles.rectangle.stack", label: "GIF" },
  { id: "project", icon: "folder", label: "Guardar proyecto" },
  { id: "share", icon: "square.and.arrow.up", label: "Compartir" },
  { id: "gesture", icon: "hand.draw", label: "Preset gestual" },
];

// panel Exportar: nombre editable, estado del guardado manual y salidas en módulos
export function ExportPanel({ name, readOnly, status, draft: isDraft, unavailable, job, onRename, onAction }: Props) {
  const [draft, setDraft] = useState(name);
  const { ref: revealRef, onFocus: revealOnFocus } = useRevealOnFocus();
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
      <View style={styles.nameRow} ref={revealRef} collapsable={false}>
        <TextInput
          onFocus={revealOnFocus}
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
      <ActionGrid
        actions={ROWS.map((r) => ({ ...r, reason: unavailable[r.id] ?? null }))}
        disabled={job !== null}
        onPress={onAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.title, fontWeight: "600", paddingVertical: 2 },
  status: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1, marginBottom: space.sm },
  job: { gap: 6, marginBottom: space.xs },
  jobHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  jobLabel: { color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  cancel: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600", letterSpacing: 1 },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.inkRaised, overflow: "hidden" },
  fill: { height: 3, backgroundColor: colors.inkText },
});
