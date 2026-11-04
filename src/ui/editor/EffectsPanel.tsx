import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EFFECT_BY_ID, EFFECTS } from "../../engine/registry";
import type { EffectId, Layer, Route, SourceConfig, SourceId } from "../../state/types";
import { Pill } from "../kit/Pill";
import { colors, radius, type } from "../tokens";
import { RouteRow } from "./RouteRow";
import { SourceEditor, type ModSourceId } from "./SourceEditor";

const CATEGORIES = [
  { id: "image", label: "IMAGEN", milestone: null },
  { id: "generator", label: "GENERADOR", milestone: "M8" },
  { id: "mod", label: "MOD", milestone: null },
] as const;
type Category = (typeof CATEGORIES)[number]["id"];

const MOD_TILES: { id: ModSourceId | "mic"; label: string; disabled?: boolean }[] = [
  { id: "lfo", label: "LFO" },
  { id: "adsr", label: "ADSR" },
  { id: "sh", label: "S&H" },
  { id: "seq", label: "SEQ" },
  { id: "tempo", label: "TEMPO" },
  { id: "mic", label: "MIC · M9", disabled: true },
];

const TILE = 71;

type Props = {
  layers: readonly Layer[];
  routes: readonly Route[];
  sources: SourceConfig;
  selectedLayerId: string | null;
  warning: string | null;
  onTile: (effect: EffectId) => void;
  onRouteSource: (layerId: string, axis: "x" | "y", source: SourceId) => void;
  onRouteAmount: (layerId: string, axis: "x" | "y", amount: number) => void;
  onSources: (next: SourceConfig) => void;
  onTempo: (bpm: number) => void;
};

/**
 * Panel Efectos (4.2): fichas de efecto con tres estados (el número es la posición en la
 * pila), modulación por eje del efecto seleccionado y fuentes MOD (S1).
 */
export function EffectsPanel(props: Props) {
  const { layers, routes, sources, selectedLayerId, warning, onTile } = props;
  const [category, setCategory] = useState<Category>("image");
  const [modSource, setModSource] = useState<ModSourceId>("lfo");
  const effectLayers = layers.filter((l) => l.kind === "effect");
  const selected = effectLayers.find((l) => l.id === selectedLayerId);
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
        {category === "image"
          ? EFFECTS.map((effect) => {
              const index = effectLayers.findIndex((l) => l.kind === "effect" && l.effect === effect.id);
              const on = index >= 0;
              const isSel = on && effectLayers[index].id === selectedLayerId;
              return (
                <Tile
                  key={effect.id}
                  label={effect.label}
                  on={on}
                  selected={isSel}
                  badge={on ? String(index + 1) : null}
                  onPress={() => onTile(effect.id)}
                />
              );
            })
          : MOD_TILES.map((m) => (
              <Tile
                key={m.id}
                label={m.label}
                on={false}
                selected={m.id === modSource}
                disabled={m.disabled}
                badge={null}
                onPress={() => m.id !== "mic" && setModSource(m.id)}
              />
            ))}
      </ScrollView>

      {warning && <Text style={styles.warning}>{warning}</Text>}

      {category === "image" &&
        (selected?.kind === "effect" ? (
          <View style={styles.routes}>
            <Text style={styles.readout}>
              {EFFECT_BY_ID[selected.effect].label} · X {selected.params.x.toFixed(2)} · Y {selected.params.y.toFixed(2)} ·
              ARRASTRA SOBRE LA IMAGEN · DOBLE TOQUE REINICIA
            </Text>
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
          <Text style={styles.readout}>TOCA UNA FICHA PARA ENCENDER UN EFECTO</Text>
        ))}

      {category === "mod" && (
        <SourceEditor source={modSource} sources={sources} onChange={props.onSources} onTempo={props.onTempo} />
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
