import { BlurView } from "expo-blur";
import type { SFSymbol } from "expo-symbols";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../kit/Icon";

import { ALL_ORIENTATIONS, useLayout } from "../useLayout";
import { colors, geometry, radius, type } from "../tokens";

type Result = { ok: true } | { ok: false; error: string };
type Mode = "actions" | "rename" | "delete";

type Props = {
  // null = cerrada
  project: { id: string; name: string; readOnly: boolean } | null;
  onClose: () => void;
  onRename: (id: string, name: string) => Result;
  onDuplicate: (id: string) => Result;
  onDelete: (id: string) => Result;
};

// hoja inferior de acciones de un proyecto. Renombrar y confirmar la eliminación se muestran
// encima, en la misma hoja; tocar fuera o CANCELAR cierra
export function ProjectActionsSheet({ project, onClose, onRename, onDuplicate, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const { regular, panelWidth } = useLayout();
  const [mode, setMode] = useState<Mode>("actions");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null>(null);

  // cada vez que se abre, la hoja empieza en las acciones
  if (!project && shownFor !== null) setShownFor(null);
  if (project && project.id !== shownFor) {
    setShownFor(project.id);
    setMode("actions");
    setName(project.name);
    setError(null);
  }

  const run = (action: (id: string) => Result) => {
    if (!project) return;
    const result = action(project.id);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <Modal
      visible={project !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={[...ALL_ORIENTATIONS]}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + geometry.compactMargin }, regular && { width: panelWidth, alignSelf: "center" }]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.handle} />
          <Text style={styles.section}>{mode === "delete" ? "ELIMINAR" : mode === "rename" ? "RENOMBRAR" : "PROYECTO"}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {mode === "delete" ? "¿Eliminar el proyecto?" : project?.name}
          </Text>

          {mode === "actions" && (
            <>
              <SheetButton label="Renombrar" icon="pencil" disabled={project?.readOnly} onPress={() => setMode("rename")} />
              <SheetButton label="Duplicar" icon="plus.square.on.square" onPress={() => run(onDuplicate)} />
              <SheetButton label="Eliminar" icon="trash" onPress={() => setMode("delete")} />
              <SheetButton label="Cancelar" muted onPress={onClose} />
            </>
          )}

          {mode === "rename" && (
            <>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                autoFocus
                selectTextOnFocus
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={() => run((id) => onRename(id, name))}
                accessibilityLabel="Nombre del proyecto"
                style={styles.input}
              />
              <SheetButton label="Guardar" icon="checkmark" onPress={() => run((id) => onRename(id, name))} />
              <SheetButton label="Cancelar" muted onPress={() => setMode("actions")} />
            </>
          )}

          {mode === "delete" && (
            <>
              <Text style={styles.body}>Se borran «{project?.name}» y su imagen. No se puede deshacer.</Text>
              <SheetButton label="Eliminar" icon="trash" onPress={() => run(onDelete)} />
              <SheetButton label="Cancelar" muted onPress={() => setMode("actions")} />
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetButton({
  label,
  icon,
  onPress,
  muted = false,
  disabled = false,
}: {
  label: string;
  icon?: SFSymbol;
  onPress: () => void;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, muted && styles.buttonMuted, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {icon && <Icon name={icon} size={16} />}
      <Text style={[styles.buttonText, muted && styles.muted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    overflow: "hidden",
    backgroundColor: "rgba(18,18,18,0.9)",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: geometry.compactMargin,
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginVertical: 12, backgroundColor: colors.inkLineStrong },
  section: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.4, marginBottom: 4 },
  title: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.title,
    marginBottom: 8,
  },
  body: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body, marginBottom: 8 },
  input: {
    minHeight: geometry.target,
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.body,
    backgroundColor: colors.inkRaised,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  button: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
  buttonMuted: { backgroundColor: "transparent", justifyContent: "center" },
  buttonText: { color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600" },
  muted: { color: colors.inkMute },
  error: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, marginTop: 8 },
});
