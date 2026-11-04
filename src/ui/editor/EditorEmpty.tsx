import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../AppHeader";
import { Button } from "../kit/Button";
import { Icon } from "../kit/Icon";
import { colors, radius, space, type } from "../tokens";

type Props = {
  busy: boolean;
  message: string | null;
  onImport: () => void;
  onCamera: () => void;
  onDismissMessage: () => void;
};

/** Editor sin proyecto: importar desde Fotos o ir a la cámara. */
export function EditorEmpty({ busy, message, onImport, onCamera, onDismissMessage }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <AppHeader />
      <View style={styles.center}>
        <View style={styles.badge}>
          <Icon name="photo.on.rectangle.angled" size={34} />
        </View>
        <Text style={styles.title}>Sin imagen</Text>
        <Text style={styles.subtitle}>Toma o importa una imagen para empezar a editar</Text>
        <View style={styles.buttons}>
          <Button label={busy ? "Importando…" : "Importar desde Fotos"} icon="photo.badge.plus" disabled={busy} onPress={onImport} />
          <Button label="Ir a cámara" icon="camera" variant="secondary" disabled={busy} onPress={onCamera} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl, paddingBottom: 60 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: radius.lg,
    backgroundColor: colors.inkRaised,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.title, fontWeight: "600" },
  subtitle: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body - 2, marginTop: space.xs, textAlign: "center" },
  buttons: { alignSelf: "stretch", marginTop: space.xl, gap: space.sm },
  message: {
    marginTop: space.lg,
    color: colors.paperText,
    backgroundColor: colors.paper,
    fontFamily: type.family,
    fontSize: type.label,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
});
