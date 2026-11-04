import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";

import { colors } from "../tokens";

/**
 * Contenedor de panel sobre la barra inferior. Deslizar hacia abajo lo cierra (3.9).
 * El gesto corre en el hilo de JS (runOnJS) para no llamar a JS desde un worklet.
 */
export function PanelSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const flingDown = Gesture.Fling()
    .direction(Directions.DOWN)
    .runOnJS(true)
    .onEnd(() => onClose());

  return (
    <GestureDetector gesture={flingDown}>
      <View style={styles.root}>
        <View style={styles.handle} />
        {children}
      </View>
    </GestureDetector>
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
