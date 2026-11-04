import { ScrollView, StyleSheet } from "react-native";

import { Pill } from "./kit/Pill";

export type Chip<T extends string | number> = { id: T; label: string; disabled?: boolean };

/** Fila horizontal de pastillas; la seleccionada va invertida. */
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
      {chips.map((c) => (
        <Pill key={String(c.id)} label={c.label} selected={c.id === value} disabled={c.disabled} onPress={() => onChange(c.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
});
