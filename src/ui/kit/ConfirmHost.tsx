import { BlurView } from "expo-blur";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";

import { colors, COMPACT_FONT_SCALE, geometry, radius, space, type } from "../tokens";
import { ALL_ORIENTATIONS, useLayout } from "../useLayout";
import { Button } from "./Button";
import { answerConfirm, confirmStore } from "../../state/confirm";

// hoja de confirmación, con la misma forma que la hoja de proyecto de la Galería: sección,
// título, explicación breve, la acción en blanco y Cancelar como texto. Tocar fuera cancela
export function ConfirmHost() {
  const request = useStore(confirmStore, (s) => s.request);
  const insets = useSafeAreaInsets();
  const { regular, panelWidth } = useLayout();

  return (
    <Modal
      visible={request !== null}
      transparent
      animationType="fade"
      onRequestClose={() => answerConfirm(null)}
      supportedOrientations={[...ALL_ORIENTATIONS]}
    >
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" style={styles.backdrop} onPress={() => answerConfirm(null)} />
        {request && (
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { paddingBottom: insets.bottom + geometry.compactMargin }, regular && styles.sheetRegular, regular && { width: Math.min(panelWidth, 440) }]}
          >
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.handle} />
            <Text style={styles.section} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
              {request.section}
            </Text>
            <Text style={styles.title} accessibilityRole="header">
              {request.title}
            </Text>
            {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
            <View style={styles.actions}>
              {request.actions.map((a) => (
                <Button key={a.id} label={a.label} icon={a.icon} variant={a.variant ?? "secondary"} onPress={() => answerConfirm(a.id)} />
              ))}
              <Button label={request.cancelLabel ?? "Cancelar"} variant="ghost" onPress={() => answerConfirm(null)} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: {
    overflow: "hidden",
    backgroundColor: colors.sheet,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: geometry.compactMargin,
  },
  // en iPad la hoja se centra en la pantalla con las cuatro esquinas redondeadas
  sheetRegular: { alignSelf: "center", marginBottom: "auto", marginTop: "auto", borderRadius: radius.lg, paddingTop: space.sm },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginVertical: 12, backgroundColor: colors.inkLineStrong },
  section: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.4, marginBottom: 4 },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.title, marginBottom: space.sm },
  message: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body, lineHeight: 20, marginBottom: space.sm },
  actions: { gap: space.sm, marginTop: space.sm },
});
