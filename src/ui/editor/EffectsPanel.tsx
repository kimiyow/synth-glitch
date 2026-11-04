import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EFFECT_BY_ID, EFFECTS, GENERATOR_BY_ID, GENERATORS } from "../../engine/registry";
import { selectFeedback } from "../../platform/haptics";
import type { BlendMode, EffectId, GeneratorId, Layer } from "../../state/types";
import { ChipRow, type Chip } from "../ChipRow";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
import { Pill } from "../kit/Pill";
import { Slider } from "../Slider";
import { colors, radius, space, type } from "../tokens";

const CATEGORIES = [
  { id: "image", label: "IMAGEN" },
  { id: "generator", label: "GENERADOR" },
] as const;
type Category = (typeof CATEGORIES)[number]["id"];

/** Ficha tocada: un efecto global o un generador (una capa de cada uno como máximo). */
export type TileRef = { kind: "effect"; effect: EffectId } | { kind: "generator"; generator: GeneratorId };

const BLENDS: readonly Chip<BlendMode>[] = [
  { id: "screen", label: "SCREEN" },
  { id: "multiply", label: "MULTIPLY" },
  { id: "difference", label: "DIFFERENCE" },
  { id: "replace", label: "REPLACE" },
];

export const THUMB_SIZE = 64;

/** Capa con valores por defecto, para la miniatura de una ficha apagada (una sola instancia por ficha). */
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
  warning: string | null;
  /** Dibuja la miniatura de una capa (vive en editor/, que sí conoce Skia). */
  renderThumb: (layer: Layer) => ReactNode;
  /** Enciende (si estaba apagada) y selecciona la capa de la ficha. */
  onTile: (tile: TileRef) => void;
  onRemove: (layerId: string) => void;
  onReset: (layerId: string) => void;
  onBlend: (layerId: string, blend: BlendMode) => void;
  onSeed: (layerId: string) => void;
  /** Deslizador: inicio, cada movimiento (vista previa) y fin (un cambio deshacible, 3.8). */
  onParamStart: (layerId: string) => void;
  onParam: (layerId: string, axis: "x" | "y", value: number) => void;
  onParamEnd: (layerId: string) => void;
  onModulate: () => void;
};

/**
 * Panel Efectos al estilo Picsart: una tira de miniaturas con el efecto aplicado a la
 * imagen; tocar una abre ese efecto con sus parámetros con nombre (tablas 6.3 y 6.4),
 * modo de mezcla y semilla para generadores (GEN-02). El gesto X/Y sobre la imagen sigue activo.
 */
export function EffectsPanel(props: Props) {
  const { layers, selectedLayerId, warning } = props;
  const [category, setCategory] = useState<Category>("image");
  const [editing, setEditing] = useState(false);
  const selected = layers.find((l) => l.id === selectedLayerId) ?? null;

  if (editing && selected) {
    return <EffectDetail {...props} layer={selected} onBack={() => setEditing(false)} />;
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
      <View style={styles.categories}>
        {CATEGORIES.map((c) => (
          <Pill key={c.id} label={c.label} selected={c.id === category} onPress={() => setCategory(c.id)} />
        ))}
      </View>

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
              thumb={props.renderThumb(layer)}
              onPress={() => open(t.tile)}
            />
          );
        })}
      </ScrollView>

      {warning && <Text style={styles.warning}>{warning}</Text>}
      <Text style={styles.hint}>TOCA UN EFECTO PARA PERSONALIZARLO</Text>
    </View>
  );
}

function EffectDetail(props: Props & { layer: Layer; onBack: () => void }) {
  const { layer, warning } = props;
  const def = layer.kind === "effect" ? EFFECT_BY_ID[layer.effect] : GENERATOR_BY_ID[layer.generator];
  const axes = (["x", "y"] as const).map((axis) => ({ axis, label: def.axes[axis], value: layer.params[axis] }));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon="chevron.left" label="Volver a los efectos" size={34} onPress={props.onBack} />
        <Text style={styles.title} numberOfLines={1}>
          {def.label}
        </Text>
        <IconButton icon="arrow.counterclockwise" label="Restablecer" size={34} onPress={() => props.onReset(layer.id)} />
        <IconButton
          icon="trash"
          label="Quitar efecto"
          size={34}
          onPress={() => {
            props.onRemove(layer.id);
            props.onBack();
          }}
        />
      </View>

      <View style={styles.sliders}>
        {axes.map((a) => (
          <Slider
            key={a.axis}
            label={a.label}
            value={a.value}
            onSlidingStart={() => props.onParamStart(layer.id)}
            onChange={(v) => props.onParam(layer.id, a.axis, Math.round(v * 1000) / 1000)}
            onSlidingEnd={() => props.onParamEnd(layer.id)}
          />
        ))}
      </View>

      {layer.kind === "generator" && (
        <>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Mezcla</Text>
            <View style={styles.rowBody}>
              <ChipRow chips={BLENDS} value={layer.blend} onChange={(b) => props.onBlend(layer.id, b)} />
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Semilla</Text>
            <Text style={styles.seed}>{layer.seed ?? 0}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Semilla aleatoria"
              onPress={() => {
                selectFeedback();
                props.onSeed(layer.id);
              }}
              style={({ pressed }) => [styles.dice, pressed && styles.pressed]}
            >
              <Icon name="dice" size={16} />
              <Text style={styles.diceText}>ALEATORIA</Text>
            </Pressable>
          </View>
        </>
      )}

      {warning && <Text style={styles.warning}>{warning}</Text>}
      <View style={styles.footer}>
        <Text style={styles.hint}>ARRASTRA SOBRE LA IMAGEN · DOBLE TOQUE RESTABLECE</Text>
        <Pill label="MODULAR" onPress={props.onModulate} />
      </View>
    </View>
  );
}

function Tile(p: { label: string; order: number | null; selected: boolean; thumb: ReactNode; onPress: () => void }) {
  const on = p.order !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.label}${on ? `, capa ${p.order}` : ""}${p.selected ? ", seleccionado" : ""}`}
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
      </View>
      <Text style={[styles.tileLabel, on && styles.tileLabelOn]} numberOfLines={1}>
        {p.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  categories: { flexDirection: "row", gap: 6 },
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
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  badgeSelected: { backgroundColor: colors.paper },
  badgeText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, fontWeight: "700" },
  badgeTextSelected: { color: colors.paperText },
  tileLabel: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.8 },
  tileLabelOn: { color: colors.inkText },
  pressed: { opacity: 0.6 },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600", letterSpacing: 1 },
  sliders: { flexDirection: "row", gap: space.xl },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 32 },
  rowLabel: { width: 62, color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  rowBody: { flex: 1 },
  seed: { flex: 1, color: colors.inkMute, fontFamily: type.family, fontSize: type.label, fontVariant: ["tabular-nums"] },
  dice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.inkRaised,
  },
  diceText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  hint: { flexShrink: 1, color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
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
