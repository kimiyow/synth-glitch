import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "../tokens";

/**
 * Contenedor de panel sobre la barra inferior. Solo se cierra con su propio botón
 * (decisión de producto: tocar fuera o deslizar no lo cierra, para pintar cómodo).
 */
export function PanelSheet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={styles.handle} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.ink, paddingHorizontal: 16, paddingBottom: 12 },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 2,
    marginVertical: 8,
    backgroundColor: colors.inkMute,
  },
});
