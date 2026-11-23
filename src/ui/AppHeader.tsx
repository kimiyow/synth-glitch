import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PrivacyButton } from "./PrivacyButton";
import { colors, geometry, type } from "./tokens";

// cabecera del Figma: wordmark Synth VJ centrado, el aviso de privacidad siempre a la izquierda y una
// acción opcional a la derecha
export function AppHeader({ right }: { right?: ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <PrivacyButton />
      </View>
      <Text style={styles.wordmark}>Synth VJ</Text>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  wordmark: { color: colors.inkText, fontFamily: type.family, fontSize: type.title },
  left: { position: "absolute", left: geometry.compactMargin - 8, top: 0, bottom: 0, justifyContent: "center" },
  right: {
    position: "absolute",
    right: geometry.compactMargin,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
