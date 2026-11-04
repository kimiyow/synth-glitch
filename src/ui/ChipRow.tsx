import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { colors, type } from "./tokens";

export type Chip<T extends string | number> = { id: T; label: string; disabled?: boolean };

/** Fila de chips de texto (estilo de los chips del panel Pincel del Figma). */
export function ChipRow<T extends string | number>({
  chips,
  value,
  onChange,
}: {
  chips: readonly Chip<T>[];
  value: T | null;
  onChange: (id: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips.map((c) => {
        const on = c.id === value;
        return (
          <Pressable
            key={String(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: c.disabled }}
            disabled={c.disabled}
            onPress={() => onChange(c.id)}
            style={[styles.chip, on && styles.on, c.disabled && styles.disabled]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  chip: { borderColor: colors.inkLineStrong, borderWidth: 1, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 4 },
  on: { backgroundColor: colors.paper, borderColor: colors.paper },
  disabled: { opacity: 0.4 },
  text: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro + 1 },
  textOn: { color: colors.paperText },
});
