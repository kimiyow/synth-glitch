import { BlurView } from "expo-blur";
import { createContext, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { selectFeedback } from "../../platform/haptics";
import { colors, radius, space, type } from "../tokens";
import { useLayout } from "../useLayout";
import { IconButton } from "./IconButton";

// los deslizadores bloquean el desplazamiento de la hoja mientras se arrastran: si no, la hoja (que
// en iOS rebota aunque el contenido quepa) se queda con el toque y el control salta
export const SheetScrollLock = createContext<(locked: boolean) => void>(() => {});

// ancho de la tarjeta lateral (iPad en horizontal)
export const SIDE_CARD_WIDTH = 380;

// hoja con esquinas redondeadas y fondo translúcido que flota sobre el lienzo. Se cierra solo con
// botones propios (nunca tocando fuera ni deslizando): ✕ la cierra; tocar la barrita la minimiza
// para ver la imagen completa sin perder lo que se estaba editando. side: tarjeta a la derecha que
// crece hasta el alto disponible (iPad horizontal)
export function Sheet({
  title,
  children,
  maxHeight = 300,
  side = false,
  onClose,
}: {
  title?: string;
  children: ReactNode;
  maxHeight?: number;
  side?: boolean;
  onClose?: () => void;
}) {
  const [locked, setLocked] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const lock = useMemo(() => (on: boolean) => setLocked(on), []);
  const { regular, panelWidth } = useLayout();
  return (
    <View style={[styles.root, side ? styles.side : regular && [styles.floating, { width: panelWidth }]]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.top}>
        {/* título de la sección a la izquierda, barrita al centro, ✕ a la derecha */}
        <Text style={styles.topTitle} numberOfLines={1} accessibilityRole="header">
          {title?.toUpperCase() ?? ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={minimized ? "Mostrar panel" : "Minimizar panel"}
          hitSlop={{ top: 8, bottom: 8, left: 40, right: 40 }}
          onPress={() => {
            selectFeedback();
            setMinimized((m) => !m);
          }}
          style={styles.handleHit}
        >
          <View style={[styles.handle, minimized && styles.handleMin]} />
        </Pressable>
        <View style={styles.topRight}>
          {onClose && <IconButton icon="xmark" label="Cerrar panel" size={28} bare onPress={onClose} />}
        </View>
      </View>
      {/* minimizado: el contenido sigue montado (conserva su estado) pero no ocupa espacio */}
      <View style={minimized ? styles.hidden : side ? styles.sideBody : undefined}>
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
  side: {
    width: SIDE_CARD_WIDTH,
    maxHeight: "100%",
    alignSelf: "flex-end",
    marginRight: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inkLine,
  },
  sideBody: { flexShrink: 1 },
  sideScroll: { flexGrow: 0, flexShrink: 1 },
  hidden: { height: 0, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", height: 36, marginRight: -space.sm },
  topTitle: { flex: 1, color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.4 },
  topRight: { flex: 1, alignItems: "flex-end" },
  handleHit: { width: 72, height: 36, alignItems: "center", justifyContent: "center" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.inkLineStrong },
  handleMin: { width: 48, backgroundColor: colors.inkText },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600", marginBottom: space.sm },
  content: { gap: space.md, paddingBottom: space.xs },
});
