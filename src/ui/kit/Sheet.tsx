import { BlurView } from "expo-blur";
import { createContext, useContext, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { selectFeedback } from "../../platform/haptics";
import { colors, radius, space, type } from "../tokens";
import { useLayout } from "../useLayout";
import { IconButton } from "./IconButton";

// los deslizadores bloquean el desplazamiento de la hoja mientras se arrastran: si no, la hoja (que
// en iOS rebota aunque el contenido quepa) se queda con el toque y el control salta
export const SheetScrollLock = createContext<(locked: boolean) => void>(() => {});

// lo que un panel puede pedirle a su hoja: fijar algo arriba (fuera del desplazamiento) y llevar
// un elemento a la vista. null fuera de una hoja
export type SheetControls = {
  pin: (node: ReactNode) => void;
  scrollIntoView: (target: RefObject<ComponentRef<typeof View> | null>) => void;
};
export const SheetPin = createContext<SheetControls | null>(null);
// espera a que el teclado termine de subir (y la hoja de encogerse) antes de desplazar
const REVEAL_DELAY_MS = 320;

// para un campo de texto dentro de una hoja: al enfocarlo, la hoja lo desplaza a la vista (el
// teclado encoge la hoja y el campo podía quedar fuera). ref va en una View que envuelve el campo
export function useRevealOnFocus() {
  const sheet = useContext(SheetPin);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const onFocus = () => {
    setTimeout(() => sheet?.scrollIntoView(ref), REVEAL_DELAY_MS);
  };
  return { ref, onFocus };
}

// alto que se le resta al desplazamiento mientras hay algo fijado (la hoja crece el resto)
const PIN_ALLOWANCE = 48;

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
  const [pinned, setPinned] = useState<ReactNode>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<ComponentRef<typeof View>>(null);
  const controls = useMemo<SheetControls>(
    () => ({
      pin: (node) => setPinned(node),
      scrollIntoView: (target) => {
        const node = target.current;
        const content = contentRef.current;
        if (!node || !content) return;
        node.measureLayout(content, (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - space.xs), animated: true }));
      },
    }),
    [],
  );
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
          {onClose && <IconButton icon="xmark" label="Cerrar panel" size={32} bare onPress={onClose} />}
        </View>
      </View>
      {/* franja fija (p. ej. la vista en vivo de la modulación abierta): no se desplaza */}
      {pinned && !minimized && <View style={styles.pinned}>{pinned}</View>}
      {/* minimizado: el contenido sigue montado (conserva su estado) pero no ocupa espacio */}
      <View style={minimized ? styles.hidden : side ? styles.sideBody : undefined}>
        <ScrollView
          ref={scrollRef}
          style={side ? styles.sideScroll : { maxHeight: pinned ? maxHeight - PIN_ALLOWANCE : maxHeight }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
          scrollEnabled={!locked}
        >
          <View ref={contentRef} style={styles.contentInner} collapsable={false}>
            <SheetPin.Provider value={controls}>
              <SheetScrollLock.Provider value={lock}>{children}</SheetScrollLock.Provider>
            </SheetPin.Provider>
          </View>
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
    backgroundColor: colors.sheet,
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
  pinned: { paddingBottom: space.sm, marginBottom: space.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.inkLine },
  contentInner: { gap: space.md },
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
