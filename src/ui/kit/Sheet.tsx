import { BlurView } from "expo-blur";
import { createContext, useMemo, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius, space, type } from "../tokens";
import { useLayout } from "../useLayout";

/**
 * Los deslizadores bloquean el desplazamiento de la hoja mientras se arrastran: si no, la
 * hoja (que en iOS rebota aunque el contenido quepa) se queda con el toque y el control salta.
 */
/**
 * Ancho del panel lateral en iPad. El SDD (4.4) pedía popovers de 340 pt, pero quedaban
 * chicos y encima del lienzo: el panel se acopla a la derecha y el lienzo le deja sitio.
 */
export const SIDE_PANEL_WIDTH = 400;

export const SheetScrollLock = createContext<(locked: boolean) => void>(() => {});

/**
 * Hoja inferior con esquinas redondeadas y fondo translúcido. Solo se cierra con su
 * propio botón (decisión de producto, sustituye a S8).
 */
export function Sheet({
  title,
  children,
  maxHeight = 300,
  side = false,
}: {
  title?: string;
  children: ReactNode;
  maxHeight?: number;
  /** iPad: panel lateral fijo a la derecha, de toda la altura, sin tapar el lienzo. */
  side?: boolean;
}) {
  const [locked, setLocked] = useState(false);
  const lock = useMemo(() => (on: boolean) => setLocked(on), []);
  const { regular, panelWidth } = useLayout();
  return (
    <View style={[styles.root, side ? styles.side : regular && [styles.floating, { width: panelWidth }]]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      {!side && <View style={styles.handle} />}
      {title && <Text style={styles.title}>{title}</Text>}
      <ScrollView
        style={side ? styles.sideScroll : { maxHeight }}
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
    backgroundColor: "rgba(18,18,18,0.82)",
    borderTopColor: colors.inkLine,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  sideScroll: { flexGrow: 0, flexShrink: 1 },
  side: {
    width: SIDE_PANEL_WIDTH,
    alignSelf: "flex-start",
    maxHeight: "100%",
    marginRight: space.md,
    marginBottom: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inkLine,
    paddingTop: space.sm,
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
