import type { SFSymbol } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { selectFeedback } from "../../platform/haptics";
import { colors, COMPACT_FONT_SCALE, radius, type } from "../tokens";
import { Icon } from "./Icon";

export type IconTile<T extends string> = { id: T; label: string; icon: SFSymbol; hint?: string };

// fila de fichas con icono y nombre corto, a todo el ancho; la elegida va invertida. Es el selector
// de herramientas y fuentes del editor (Pincel, fuentes de modulación)
export function IconTiles<T extends string>({
  tiles,
  value,
  onChange,
}: {
  tiles: readonly IconTile<T>[];
  // null: ninguna elegida en esta fila (p. ej. la elección está en otro grupo)
  value: T | null;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.row}>
      {tiles.map((t) => {
        const on = t.id === value;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={t.hint ? `${t.label}: ${t.hint}` : t.label}
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              selectFeedback();
              onChange(t.id);
            }}
            style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && styles.pressed]}
          >
            <Icon name={t.icon} size={16} color={on ? colors.paperText : colors.inkText} />
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3 },
  tile: { flex: 1, minHeight: 52, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.inkRaised, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2 },
  tileOn: { backgroundColor: colors.paper },
  pressed: { opacity: 0.6 },
  text: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.4 },
  textOn: { color: colors.paperText, fontWeight: "700" },
});
