import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CAMERA_ASPECTS, type CameraAspect } from "../../state/settings";
import { colors, geometry, type } from "../tokens";

type Props = {
  visible: boolean;
  aspect: CameraAspect;
  onSelect: (aspect: CameraAspect) => void;
  onClose: () => void;
};

/** Menú `⋯` de la cámara: relación de aspecto (CAM-04). Tocar fuera lo cierra. */
export function CameraMenu({ visible, aspect, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Cerrar menú" style={styles.backdrop} onPress={onClose} />
      <View style={[styles.menu, { top: insets.top + geometry.target }]}>
        <Text style={styles.heading}>RELACIÓN</Text>
        {CAMERA_ASPECTS.map((a) => (
          <Pressable
            key={a}
            accessibilityRole="button"
            accessibilityState={{ selected: a === aspect }}
            onPress={() => {
              onSelect(a);
              onClose();
            }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Text style={[styles.itemText, a === aspect && styles.selected]}>{a}</Text>
            {a === aspect && <Text style={styles.itemText}>✓</Text>}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  menu: {
    position: "absolute",
    right: geometry.compactMargin,
    width: 180,
    backgroundColor: colors.ink,
    borderColor: colors.inkLineStrong,
    borderWidth: geometry.hairline,
    paddingVertical: 4,
  },
  heading: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.2,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  item: {
    minHeight: geometry.target,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pressed: { opacity: 0.6 },
  itemText: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body },
  selected: { color: colors.inkText },
});
