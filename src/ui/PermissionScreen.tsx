import { Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "./kit/Button";
import { colors, space, type } from "./tokens";

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
        <Button label="Permitir" surface="paper" onPress={onAllow} />
      ) : (
        <Button label="Abrir Ajustes" icon="gearshape" surface="paper" onPress={() => Linking.openSettings()} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, padding: space.xl, justifyContent: "space-between" },
  body: { gap: space.md, paddingTop: 48 },
  title: { color: colors.paperText, fontFamily: type.family, fontSize: type.display, fontWeight: "600" },
  reason: { color: colors.paperMute, fontFamily: type.family, fontSize: type.body, lineHeight: 22 },
});
