import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { colors } from "../tokens";

/**
 * Contenedor de panel sobre la barra inferior. Solo se cierra con su propio botón
 * (decisión de producto: tocar fuera o deslizar no lo cierra, para pintar cómodo).
 */
export function PanelSheet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={styles.handle} />
      {/* Altura máxima: el lienzo no debe quedar aplastado; el resto se desplaza. */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.ink, paddingHorizontal: 16, paddingBottom: 12 },
  scroll: { maxHeight: 280 },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 2,
    marginVertical: 8,
    backgroundColor: colors.inkMute,
  },
});
