import type { SFSymbol } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tapFeedback } from "../../platform/haptics";
import { colors, radius, space, type } from "../tokens";
import { Icon } from "./Icon";

export type GridAction<T extends string> = {
  id: T;
  icon: SFSymbol;
  label: string;
  // motivo por el que no está disponible (se muestra pequeño en la ficha), o null
  reason?: string | null;
};

// acciones del panel en fichas de dos columnas: icono arriba, nombre corto abajo (Exportar, Presets)
export function ActionGrid<T extends string>({
  actions,
  disabled = false,
  onPress,
}: {
  actions: readonly GridAction<T>[];
  disabled?: boolean;
  onPress: (id: T) => void;
}) {
  return (
    <View style={styles.grid}>
      {actions.map((a) => {
        const off = disabled || !!a.reason;
        return (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            accessibilityLabel={a.reason ? `${a.label}, ${a.reason}` : a.label}
            accessibilityState={{ disabled: off }}
            disabled={off}
            onPress={() => {
              tapFeedback();
              onPress(a.id);
            }}
            style={({ pressed }) => [styles.tile, off && styles.off, pressed && styles.pressed]}
          >
            <Icon name={a.icon} size={20} />
            <Text style={styles.label} numberOfLines={1}>
              {a.label}
            </Text>
            {a.reason && (
              <Text style={styles.reason} numberOfLines={1}>
                {a.reason}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { width: "48.5%", minHeight: 72, padding: space.md, gap: 6, borderRadius: radius.md, backgroundColor: colors.inkRaised, justifyContent: "flex-end" },
  off: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  label: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  reason: { position: "absolute", top: space.sm, right: space.sm, color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.6 },
});
