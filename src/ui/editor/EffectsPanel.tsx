import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EFFECTS } from "../../engine/registry";
import type { EffectId, Layer } from "../../state/types";
import { colors, type } from "../tokens";

const CATEGORIES = [
  { id: "image", label: "IMAGEN", milestone: null },
  { id: "generator", label: "GENERADOR", milestone: "M8" },
  { id: "mod", label: "MOD", milestone: "M7" },
] as const;

const TILE = 71;

type Props = {
  layers: readonly Layer[];
  selectedLayerId: string | null;
  onTile: (effect: EffectId) => void;
};

/**
 * Panel Efectos (4.2): fichas con tres estados — apagada, encendida y seleccionada,
 * encendida sin seleccionar. El número indica la posición en la pila.
 */
export function EffectsPanel({ layers, selectedLayerId, onTile }: Props) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("image");
  const effectLayers = layers.filter((l) => l.kind === "effect");

  return (
    <View style={styles.root}>
      <View style={styles.categories}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityState={{ selected: c.id === category, disabled: c.milestone !== null }}
            disabled={c.milestone !== null}
            onPress={() => setCategory(c.id)}
            style={c.milestone !== null && styles.disabled}
          >
            <Text style={[styles.category, c.id === category && styles.categoryOn]}>
              {c.label}
              {c.milestone ? ` · ${c.milestone}` : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
        {EFFECTS.map((effect) => {
          const index = effectLayers.findIndex((l) => l.kind === "effect" && l.effect === effect.id);
          const on = index >= 0;
          const selected = on && effectLayers[index].id === selectedLayerId;
          return (
            <Pressable
              key={effect.id}
              accessibilityRole="button"
              accessibilityLabel={`${effect.label}${on ? `, capa ${index + 1}` : ", apagado"}${selected ? ", seleccionado" : ""}`}
              onPress={() => onTile(effect.id)}
              style={styles.tileWrap}
            >
              <View style={[styles.tile, on && styles.tileOn, selected && styles.tileSelected]}>
                {on && <Text style={[styles.order, selected && styles.orderSelected]}>{index + 1}</Text>}
              </View>
              <Text style={[styles.tileLabel, (on || selected) && styles.tileLabelOn]}>{effect.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  categories: { flexDirection: "row", gap: 18 },
  disabled: { opacity: 0.5 },
  category: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  categoryOn: { color: colors.inkText },
  tiles: { gap: 14, paddingRight: 16 },
  tileWrap: { alignItems: "center", gap: 4 },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 6,
    backgroundColor: "#3A3A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  tileOn: { borderWidth: 1, borderColor: colors.inkLineStrong },
  tileSelected: { borderWidth: 2, borderColor: colors.inkText, backgroundColor: "#5A5A5A" },
  order: { color: colors.inkMute, fontFamily: type.family, fontSize: type.title },
  orderSelected: { color: colors.inkText },
  tileLabel: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label },
  tileLabelOn: { color: colors.inkText },
});
