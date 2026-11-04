import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../AppHeader";
import { colors, geometry, type } from "../tokens";

type Props = {
  busy: boolean;
  message: string | null;
  onImport: () => void;
  onCamera: () => void;
  onDismissMessage: () => void;
};

/** Editor sin proyecto (Figma "Editor Seccion"): importar desde Fotos o ir a la cámara. */
export function EditorEmpty({ busy, message, onImport, onCamera, onDismissMessage }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <AppHeader />
      <View style={styles.center}>
        <Text style={styles.title}>SIN IMAGEN</Text>
        <Text style={styles.subtitle}>TOMA O IMPORTA UNA IMAGEN</Text>
        <View style={styles.buttons}>
          <OutlineButton label={busy ? "IMPORTANDO…" : "IMPORTAR DESDE FOTOS"} disabled={busy} onPress={onImport} />
          <OutlineButton label="IR A CÁMARA" disabled={busy} onPress={onCamera} />
        </View>
        {message && (
          <Text style={styles.message} onPress={onDismissMessage}>
            {message}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function OutlineButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10 }}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dim]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.body },
  subtitle: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, marginTop: 6 },
  buttons: { marginTop: 48, gap: 10 },
  button: {
    width: 190,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: 1,
    borderRadius: 2,
  },
  dim: { opacity: 0.5 },
  buttonText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro + 1 },
  message: {
    marginTop: 24,
    marginHorizontal: geometry.compactMargin,
    color: colors.paperText,
    backgroundColor: colors.paper,
    fontFamily: type.family,
    fontSize: type.label,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
