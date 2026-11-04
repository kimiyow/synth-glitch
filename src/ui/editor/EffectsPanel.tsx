import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EFFECT_BY_ID, EFFECTS, GENERATOR_BY_ID, GENERATORS } from "../../engine/registry";
import type { BlendMode, EffectId, GeneratorId, Layer, Route, SourceId } from "../../state/types";
import { ChipRow, type Chip } from "../ChipRow";
import { Pill } from "../kit/Pill";
import { colors, radius, type } from "../tokens";
import { RouteRow } from "./RouteRow";

const CATEGORIES = [
  { id: "image", label: "IMAGEN", milestone: null },
  { id: "generator", label: "GENERADOR", milestone: null },
] as const;
type Category = (typeof CATEGORIES)[number]["id"];

/** Ficha tocada: un efecto global o un generador (una capa de cada uno como máximo). */
export type TileRef = { kind: "effect"; effect: EffectId } | { kind: "generator"; generator: GeneratorId };

const BLENDS: readonly Chip<BlendMode>[] = [
  { id: "replace", label: "REPLACE" },
  { id: "screen", label: "SCREEN" },
  { id: "multiply", label: "MULTIPLY" },
  { id: "difference", label: "DIFFERENCE" },
];

const TILE = 71;

type Props = {
  layers: readonly Layer[];
  routes: readonly Route[];
  selectedLayerId: string | null;
  warning: string | null;
  onTile: (tile: TileRef) => void;
  onBlend: (layerId: string, blend: BlendMode) => void;
  onRouteSource: (layerId: string, axis: "x" | "y", source: SourceId) => void;
  onRouteAmount: (layerId: string, axis: "x" | "y", amount: number) => void;
};

/**
 * Panel Efectos (4.2): fichas de efecto y de generador con tres estados (el número es la
 * posición en la pila) y modulación por eje de la capa seleccionada; los generadores suman
 * el modo de mezcla (GEN-02). Las fuentes se ajustan en el panel Mod.
 */
export function EffectsPanel(props: Props) {
  const { layers, routes, selectedLayerId, warning, onTile } = props;
  const [category, setCategory] = useState<Category>("image");
  const selected = layers.find((l) => l.id === selectedLayerId);
  const tileState = (match: (l: Layer) => boolean) => {
    const index = layers.findIndex(match);
    const on = index >= 0;
    return { on, selected: on && layers[index].id === selectedLayerId, badge: on ? String(index + 1) : null };
  };
  const routeFor = (axis: "x" | "y") =>
    routes.find((r) => r.target.layerId === selected?.id && r.target.param === axis) ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.categories}>
        {CATEGORIES.map((c) => (
          <Pill
            key={c.id}
            label={c.milestone ? `${c.label} · ${c.milestone}` : c.label}
            selected={c.id === category}
            disabled={c.milestone !== null}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
        {category === "image" &&
          EFFECTS.map((effect) => (
            <Tile
              key={effect.id}
              label={effect.label}
              {...tileState((l) => l.kind === "effect" && l.effect === effect.id)}
              onPress={() => onTile({ kind: "effect", effect: effect.id })}
            />
          ))}
        {category === "generator" &&
          GENERATORS.map((gen) => (
            <Tile
              key={gen.id}
              label={gen.label}
              {...tileState((l) => l.kind === "generator" && l.generator === gen.id)}
              onPress={() => onTile({ kind: "generator", generator: gen.id })}
            />
          ))}
      </ScrollView>

      {warning && <Text style={styles.warning}>{warning}</Text>}

      {selected ? (
        <View style={styles.routes}>
          <Text style={styles.readout}>
            {selected.kind === "effect" ? EFFECT_BY_ID[selected.effect].label : GENERATOR_BY_ID[selected.generator].label} · X{" "}
            {selected.params.x.toFixed(2)} · Y {selected.params.y.toFixed(2)} · ARRASTRA SOBRE LA IMAGEN · DOBLE TOQUE REINICIA
          </Text>
          {selected.kind === "generator" && (
            <ChipRow chips={BLENDS} value={selected.blend} onChange={(b) => props.onBlend(selected.id, b)} />
          )}
          {(["x", "y"] as const).map((axis) => {
            const r = routeFor(axis);
            return (
              <RouteRow
                key={axis}
                axis={axis}
                source={r?.source ?? "touch"}
                amount={r?.amount ?? 0.5}
                onSource={(s) => props.onRouteSource(selected.id, axis, s)}
                onAmount={(a) => props.onRouteAmount(selected.id, axis, a)}
              />
            );
          })}
        </View>
      ) : (
        <Text style={styles.readout}>
          {category === "image" ? "TOCA UNA FICHA PARA ENCENDER UN EFECTO" : "TOCA UNA FICHA PARA ENCENDER UN GENERADOR"}
        </Text>
      )}
    </View>
  );
}

function Tile(p: { label: string; on: boolean; selected: boolean; badge: string | null; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.label}${p.on ? `, capa ${p.badge}` : ""}${p.selected ? ", seleccionado" : ""}`}
      disabled={p.disabled}
      onPress={p.onPress}
      style={[styles.tileWrap, p.disabled && styles.disabled]}
    >
      <View style={[styles.tile, p.on && styles.tileOn, p.selected && styles.tileSelected]}>
        {p.badge && <Text style={[styles.order, p.selected && styles.orderSelected]}>{p.badge}</Text>}
      </View>
      <Text style={[styles.tileLabel, (p.on || p.selected) && styles.tileLabelOn]}>{p.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  categories: { flexDirection: "row", gap: 6 },
  disabled: { opacity: 0.4 },
  category: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  categoryOn: { color: colors.inkText },
  tiles: { gap: 14, paddingRight: 16 },
  tileWrap: { alignItems: "center", gap: 4 },
  tile: { width: TILE, height: TILE, borderRadius: radius.md, backgroundColor: colors.inkRaised, alignItems: "center", justifyContent: "center" },
  tileOn: { borderWidth: 1.5, borderColor: colors.inkText },
  tileSelected: { borderWidth: 0, backgroundColor: colors.paper },
  order: { color: colors.inkMute, fontFamily: type.family, fontSize: type.title },
  orderSelected: { color: colors.paperText, fontWeight: "700" },
  tileLabel: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label },
  tileLabelOn: { color: colors.inkText },
  routes: { gap: 8 },
  readout: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  warning: {
    alignSelf: "flex-start",
    color: colors.paperText,
    backgroundColor: colors.paper,
    fontFamily: type.family,
    fontSize: type.micro,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
