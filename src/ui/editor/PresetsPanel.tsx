import type { SFSymbol } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tapFeedback } from "../../platform/haptics";
import { Icon } from "../kit/Icon";
import { colors, radius, space, type } from "../tokens";

type Props = {
  readOnly: boolean;
  busy: boolean;
  onImport: () => void;
  onShare: () => void;
};

type Module = { id: string; icon: SFSymbol; label: string; milestone: string | null };

const MODULES: Module[] = [
  { id: "import", icon: "square.and.arrow.down", label: "Importar .synthfx", milestone: null },
  { id: "share", icon: "square.and.arrow.up", label: "Compartir .synthfx", milestone: null },
  { id: "save", icon: "square.stack.3d.up", label: "Guardar escena", milestone: "M7" },
  { id: "mutate", icon: "wand.and.rays", label: "Mutar", milestone: "M7" },
  { id: "random", icon: "dice", label: "Aleatorizar", milestone: "M7" },
];

/**
 * Panel Presets (4.2), versión mínima de M8: importar y compartir la receta `.synthfx`
 * (SEN-05). Presets de escena, MUTAR y ALEATORIZAR llegan con M7.
 */
export function PresetsPanel({ readOnly, busy, onImport, onShare }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.hint}>Una receta guarda capas, modulación y semilla, sin la pintura.</Text>
      <View style={styles.grid}>
        {MODULES.map((m) => {
          const off = m.milestone !== null || busy || (m.id === "import" && readOnly);
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={m.label}
              accessibilityState={{ disabled: off }}
              disabled={off}
              onPress={() => {
                tapFeedback();
                if (m.id === "import") onImport();
                if (m.id === "share") onShare();
              }}
              style={({ pressed }) => [styles.module, off && styles.off, pressed && styles.pressed]}
            >
              <Icon name={m.icon} size={22} />
              <Text style={styles.moduleLabel}>{m.label}</Text>
              {m.milestone && <Text style={styles.pending}>{m.milestone}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  hint: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  module: {
    width: "48.5%",
    minHeight: 76,
    padding: space.md,
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
  },
  off: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  moduleLabel: { color: colors.inkText, fontFamily: type.family, fontSize: type.label + 1 },
  pending: { position: "absolute", top: space.sm, right: space.sm, color: colors.inkMute, fontFamily: type.family, fontSize: type.micro },
});
