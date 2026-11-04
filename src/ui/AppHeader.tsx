import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, geometry, type } from "./tokens";

/** Cabecera del Figma: wordmark `Synth VJ` centrado y una acción opcional a la derecha. */
export function AppHeader({ right }: { right?: ReactNode }) {
  return (
    <View style={styles.root}>
      <Text style={styles.wordmark}>Synth VJ</Text>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  wordmark: { color: colors.inkText, fontFamily: type.family, fontSize: type.title },
  right: {
    position: "absolute",
    right: geometry.compactMargin,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
