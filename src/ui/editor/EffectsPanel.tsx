import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EFFECTS, GENERATORS } from "../../engine/registry";
import { selectFeedback } from "../../platform/haptics";
import type { EffectId, GeneratorId, Layer } from "../../domain/types";
import { Icon } from "../kit/Icon";
import { Segmented } from "../kit/Segmented";
import { colors, radius, space, type } from "../tokens";

const CATEGORIES = [
  { id: "image", label: "IMAGEN" },
  { id: "generator", label: "GENERADOR" },
] as const;
type Category = (typeof CATEGORIES)[number]["id"];

// ficha tocada: un efecto global o un generador (una capa de cada uno como máximo)
export type TileRef = { kind: "effect"; effect: EffectId } | { kind: "generator"; generator: GeneratorId };

export const THUMB_SIZE = 64;

// capa con valores por defecto, para la miniatura de una ficha apagada (una sola instancia por
// ficha)
const DEFAULT_LAYERS: Record<string, Layer> = Object.fromEntries([
  ...EFFECTS.map((e) => [e.id, { kind: "effect", id: e.id, effect: e.id, params: { ...e.defaults }, visible: true } satisfies Layer]),
  ...GENERATORS.map((g) => [
    g.id,
    { kind: "generator", id: g.id, generator: g.id, params: { ...g.defaults }, visible: true, blend: "screen" } satisfies Layer,
  ]),
]);

type Props = {
  layers: readonly Layer[];
  selectedLayerId: string | null;
  // capas con alguna modulación (la ficha lo indica)
  modulatedIds: ReadonlySet<string>;
  warning: string | null;
  // dibuja la miniatura de una capa (vive en editor/, que sí conoce Skia)
  renderThumb: (layer: Layer) => ReactNode;
  // inspector de la capa: parámetros y modulaciones (el mismo del panel Capas)
  renderInspector: (layer: Layer, onBack: () => void) => ReactNode;
  // enciende (si estaba apagada) y selecciona la capa de la ficha
  onTile: (tile: TileRef) => void;
};

// panel Efectos al estilo Picsart: una tira de miniaturas con el efecto aplicado a la imagen; tocar
// una abre su inspector (parámetros y modulaciones). El gesto X/Y sobre la imagen sigue activo
export function EffectsPanel(props: Props) {
  const { layers, selectedLayerId, warning } = props;
  const [category, setCategory] = useState<Category>("image");
  const [editing, setEditing] = useState(false);
  const selected = layers.find((l) => l.id === selectedLayerId) ?? null;

  if (editing && selected) {
    return <>{props.renderInspector(selected, () => setEditing(false))}</>;
  }

  const open = (tile: TileRef) => {
    props.onTile(tile);
    setEditing(true);
  };
  const tiles =
    category === "image"
      ? EFFECTS.map((e) => ({
          key: e.id,
          label: e.label,
          tile: { kind: "effect", effect: e.id } as TileRef,
          match: (l: Layer) => l.kind === "effect" && l.effect === e.id,
        }))
      : GENERATORS.map((g) => ({
          key: g.id,
          label: g.label,
          tile: { kind: "generator", generator: g.id } as TileRef,
          match: (l: Layer) => l.kind === "generator" && l.generator === g.id,
        }));

  return (
    <View style={styles.root}>
      <Segmented options={CATEGORIES} value={category} onChange={setCategory} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
        {tiles.map((t) => {
          const index = layers.findIndex(t.match);
          const layer = index >= 0 ? layers[index] : DEFAULT_LAYERS[t.key];
          return (
            <Tile
              key={t.key}
              label={t.label}
              order={index >= 0 ? index + 1 : null}
              selected={index >= 0 && layers[index].id === selectedLayerId}
              modulated={index >= 0 && props.modulatedIds.has(layers[index].id)}
              thumb={props.renderThumb(layer)}
              onPress={() => open(t.tile)}
            />
          );
        })}
      </ScrollView>

      {warning && <Text style={styles.warning}>{warning}</Text>}
    </View>
  );
}

function Tile(p: { label: string; order: number | null; selected: boolean; modulated: boolean; thumb: ReactNode; onPress: () => void }) {
  const on = p.order !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.label}${on ? `, capa ${p.order}` : ""}${p.modulated ? ", modulado" : ""}${p.selected ? ", seleccionado" : ""}`}
      onPress={() => {
        selectFeedback();
        p.onPress();
      }}
      style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}
    >
      <View style={[styles.tile, on && styles.tileOn, p.selected && styles.tileSelected]}>
        {p.thumb}
        {on && (
          <View style={[styles.badge, p.selected && styles.badgeSelected]}>
            <Text style={[styles.badgeText, p.selected && styles.badgeTextSelected]}>{p.order}</Text>
          </View>
        )}
        {p.modulated && (
          <View style={styles.modBadge}>
            <Icon name="waveform.path" size={10} />
          </View>
        )}
      </View>
      <Text style={[styles.tileLabel, on && styles.tileLabelOn]} numberOfLines={1}>
        {p.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  tiles: { gap: space.md, paddingRight: space.lg },
  tileWrap: { alignItems: "center", gap: 6, width: THUMB_SIZE + 4 },
  tile: {
    width: THUMB_SIZE + 4,
    height: THUMB_SIZE + 4,
    padding: 2,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.inkRaised,
    overflow: "hidden",
  },
  tileOn: { borderColor: colors.inkLineStrong },
  tileSelected: { borderColor: colors.paper },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.scrim,
  },
  modBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.scrim,
  },
  badgeSelected: { backgroundColor: colors.paper },
  badgeText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, fontWeight: "700" },
  badgeTextSelected: { color: colors.paperText },
  tileLabel: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.8 },
  tileLabelOn: { color: colors.inkText },
  pressed: { opacity: 0.6 },
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
