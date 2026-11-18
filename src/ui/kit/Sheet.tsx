import { BlurView } from "expo-blur";
import { createContext, useMemo, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius, space, type } from "../tokens";
import { useLayout } from "../useLayout";

// los deslizadores bloquean el desplazamiento de la hoja mientras se arrastran: si no, la hoja (que
// en iOS rebota aunque el contenido quepa) se queda con el toque y el control salta
export const SheetScrollLock = createContext<(locked: boolean) => void>(() => {});

// hoja inferior con esquinas redondeadas y fondo translúcido. Solo se cierra con su propio botón
export function Sheet({
  title,
  children,
  maxHeight = 300,
}: {
  title?: string;
  children: ReactNode;
  maxHeight?: number;
}) {
  const [locked, setLocked] = useState(false);
  const lock = useMemo(() => (on: boolean) => setLocked(on), []);
  const { regular, panelWidth } = useLayout();
  return (
    <View style={[styles.root, regular && [styles.floating, { width: panelWidth }]]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.handle} />
      {title && <Text style={styles.title}>{title}</Text>}
      <ScrollView
        style={{ maxHeight }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        scrollEnabled={!locked}
      >
        <SheetScrollLock.Provider value={lock}>{children}</SheetScrollLock.Provider>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    // con 0.9, el peor caso (blanco detrás) queda ≈ #2A2A2A: #9A9A9A sobre él ≈ 5:1
    backgroundColor: "rgba(18,18,18,0.9)",
    borderTopColor: colors.inkLine,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  floating: {
    alignSelf: "center",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inkLine,
    marginBottom: space.sm,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginVertical: space.sm,
    backgroundColor: colors.inkLineStrong,
  },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600", marginBottom: space.sm },
  content: { gap: space.md, paddingBottom: space.xs },
});
