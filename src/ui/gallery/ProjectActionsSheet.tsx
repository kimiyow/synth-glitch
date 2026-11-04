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

import { colors, geometry, type } from "../tokens";

type Result = { ok: true } | { ok: false; error: string };
type Mode = "actions" | "rename" | "delete";

type Props = {
  /** null = cerrada. */
  project: { id: string; name: string; readOnly: boolean } | null;
  onClose: () => void;
  onRename: (name: string) => Result;
  onDuplicate: () => Result;
  onDelete: () => Result;
};

/**
 * Hoja inferior de acciones de un proyecto. Renombrar y confirmar la eliminación se
 * muestran encima, en la misma hoja; tocar fuera o CANCELAR cierra.
 */
export function ProjectActionsSheet({ project, onClose, onRename, onDuplicate, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("actions");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null>(null);

  // Cada vez que se abre, la hoja empieza en las acciones.
  if (!project && shownFor !== null) setShownFor(null);
  if (project && project.id !== shownFor) {
    setShownFor(project.id);
    setMode("actions");
    setName(project.name);
    setError(null);
  }

  const run = (action: () => Result) => {
    const result = action();
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <Modal visible={project !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable accessibilityLabel="Cerrar" style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + geometry.compactMargin }]}>
          <Text style={styles.title} numberOfLines={1}>
            {mode === "delete" ? "¿ELIMINAR?" : mode === "rename" ? "RENOMBRAR" : project?.name}
          </Text>

          {mode === "actions" && (
            <>
              <SheetButton label="RENOMBRAR" disabled={project?.readOnly} onPress={() => setMode("rename")} />
              <SheetButton label="DUPLICAR" onPress={() => run(onDuplicate)} />
              <SheetButton label="ELIMINAR" onPress={() => setMode("delete")} />
              <SheetButton label="CANCELAR" muted onPress={onClose} />
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
                onSubmitEditing={() => run(() => onRename(name))}
                accessibilityLabel="Nombre del proyecto"
                style={styles.input}
              />
              <SheetButton label="GUARDAR" onPress={() => run(() => onRename(name))} />
              <SheetButton label="CANCELAR" muted onPress={() => setMode("actions")} />
            </>
          )}

          {mode === "delete" && (
            <>
              <Text style={styles.body}>
                Se borrarán «{project?.name}» y su imagen original. No se puede deshacer.
              </Text>
              <SheetButton label="ELIMINAR" onPress={() => run(onDelete)} />
              <SheetButton label="CANCELAR" muted onPress={() => setMode("actions")} />
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
  onPress,
  muted = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, muted && styles.muted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.ink,
    borderTopColor: colors.inkLineStrong,
    borderTopWidth: geometry.hairline,
    paddingHorizontal: geometry.compactMargin,
    paddingTop: geometry.compactMargin,
  },
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
    borderColor: colors.inkLineStrong,
    borderWidth: geometry.hairline,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  button: {
    minHeight: geometry.target,
    justifyContent: "center",
    borderTopColor: colors.inkLine,
    borderTopWidth: geometry.hairline,
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  muted: { color: colors.inkMute },
  error: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, marginTop: 8 },
});
