import type { SFSymbol } from "expo-symbols";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, COMPACT_FONT_SCALE, radius, space, type } from "../tokens";
import { Icon } from "./Icon";

type Props = {
  text: string;
  icon?: SFSymbol;
  // aviso (blanco, para confirmar algo) o estado (velo oscuro, p. ej. rendimiento bajo)
  tone?: "notice" | "status";
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// cápsula de aviso común sobre el lienzo y la cámara: mismo radio, tipo y relleno en toda la app
export function Toast({ text, icon, tone = "notice", onPress, style }: Props) {
  const fg = tone === "notice" ? colors.paperText : colors.inkText;
  return (
    <View
      style={[styles.root, tone === "notice" ? styles.notice : styles.status, style]}
      pointerEvents={onPress ? "auto" : "none"}
      accessibilityLiveRegion="polite"
    >
      {icon && <Icon name={icon} size={13} color={fg} />}
      <Text style={[styles.text, { color: fg }]} onPress={onPress} maxFontSizeMultiplier={COMPACT_FONT_SCALE} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    // en iPad no se estira a todo el lienzo (en iPhone el ancho de pantalla ya lo limita)
    maxWidth: 520,
    marginHorizontal: space.lg,
    minHeight: 30,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  notice: {
    backgroundColor: colors.paper,
    shadowColor: colors.ink,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  status: { backgroundColor: colors.scrim, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.inkLineStrong },
  text: { flexShrink: 1, fontFamily: type.family, fontSize: type.label, fontWeight: "600", letterSpacing: 0.6, textAlign: "center" },
});
