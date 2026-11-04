import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, geometry, type } from "./tokens";

type Props = {
  title: string;
  reason: string;
  /** false si el sistema ya no deja volver a preguntar: se ofrece abrir Ajustes (CAM-01). */
  canAskAgain: boolean;
  onAllow: () => void;
};

/** Pantalla explicativa de permisos en superficie Papel (blanca). */
export function PermissionScreen({ title, reason, canAskAgain, onAllow }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.reason}>{reason}</Text>
      </View>
      {canAskAgain ? (
        <Pressable accessibilityRole="button" onPress={onAllow} style={styles.button}>
          <Text style={styles.buttonText}>PERMITIR</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()} style={styles.button}>
          <Text style={styles.buttonText}>ABRIR AJUSTES</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, padding: geometry.compactMargin, justifyContent: "space-between" },
  body: { gap: 12, paddingTop: 48 },
  title: { color: colors.paperText, fontFamily: type.family, fontSize: type.display },
  reason: { color: colors.paperMute, fontFamily: type.family, fontSize: type.body, lineHeight: 22 },
  button: {
    minHeight: geometry.target,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paperText,
    marginBottom: geometry.compactMargin,
  },
  buttonText: { color: colors.paper, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
});
