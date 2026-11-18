import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { addModulation, MAX_MODS_PER_LAYER, rerollSeed, resetLayer, setBlend, toggleLayerVisible } from "../../actions/sceneEdits";
import type { BlendMode, Layer, Route, SourceConfig } from "../../domain/types";
import { EFFECT_BY_ID, GENERATOR_BY_ID } from "../../engine/registry";
import { selectFeedback, tapFeedback } from "../../platform/haptics";
import { ChipRow, type Chip } from "../ChipRow";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
import { Slider } from "../Slider";
import { colors, radius, space, type } from "../tokens";
import { ModCard } from "./ModCard";
import type { MicView } from "./SourceEditor";

const BLENDS: readonly Chip<BlendMode>[] = [
  { id: "screen", label: "SCREEN" },
  { id: "multiply", label: "MULTIPLY" },
  { id: "difference", label: "DIFFERENCE" },
  { id: "replace", label: "REPLACE" },
];

export type ParamDrag = {
  onParamStart: (layerId: string) => void;
  onParam: (layerId: string, axis: "x" | "y", value: number) => void;
  onParamEnd: (layerId: string) => void;
};

type Props = ParamDrag & {
  layer: Layer;
  routes: readonly Route[];
  scene: SourceConfig;
  mic: MicView;
  warning: string | null;
  onBack: () => void;
  onRemove: (layerId: string) => void;
  onNotice: (text: string) => void;
};

export function layerDef(layer: Layer) {
  return layer.kind === "effect" ? EFFECT_BY_ID[layer.effect] : GENERATOR_BY_ID[layer.generator];
}

// inspector de una capa, como un nodo: sus parámetros con nombre y debajo sus modulaciones, cada
// una con sus propios ajustes. Lo comparten los paneles Efectos y Capas
export function LayerInspector(props: Props) {
  const { layer, routes, scene, mic, warning } = props;
  const def = layerDef(layer);
  const mods = routes.filter((r) => r.target.layerId === layer.id);
  const [expanded, setExpanded] = useState<string | null>(null);

  const modulated = (axis: "x" | "y") => mods.some((r) => r.target.param === axis && r.amount !== 0);

  const add = () => {
    const xCount = mods.filter((r) => r.target.param === "x").length;
    const yCount = mods.length - xCount;
    const id = addModulation(routes, layer.id, xCount <= yCount ? "x" : "y");
    if (id) {
      tapFeedback();
      setExpanded(id);
    } else props.onNotice(`MÁXIMO ${MAX_MODS_PER_LAYER} MODULACIONES POR CAPA`);
  };
  const full = mods.length >= MAX_MODS_PER_LAYER;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon="chevron.left" label="Volver" size={34} onPress={props.onBack} />
        <Text style={styles.title} numberOfLines={1}>
          {def.label}
        </Text>
        <IconButton
          icon={layer.visible ? "eye" : "eye.slash"}
          label={layer.visible ? "Ocultar capa" : "Mostrar capa"}
          size={34}
          onPress={() => toggleLayerVisible(layer.id)}
        />
        <IconButton icon="arrow.counterclockwise" label="Restablecer parámetros" size={34} onPress={() => resetLayer(layer.id)} />
        <IconButton
          icon="trash"
          label="Quitar capa"
          size={34}
          onPress={() => {
            props.onRemove(layer.id);
            props.onBack();
          }}
        />
      </View>

      <View style={styles.sliders}>
        {(["x", "y"] as const).map((axis) => {
          return (
            <View key={axis} style={styles.flex}>
              <Slider
                label={modulated(axis) ? `∿ ${def.axes[axis]}` : def.axes[axis]}
                value={layer.params[axis]}
                onSlidingStart={() => props.onParamStart(layer.id)}
                onChange={(v) => props.onParam(layer.id, axis, Math.round(v * 1000) / 1000)}
                onSlidingEnd={() => props.onParamEnd(layer.id)}
              />
            </View>
          );
        })}
      </View>

      {layer.kind === "generator" && (
        <>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Mezcla</Text>
            <View style={styles.flex}>
              <ChipRow chips={BLENDS} value={layer.blend} onChange={(b) => setBlend(layer.id, b)} />
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
                rerollSeed(layer.id);
              }}
              style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]}
            >
              <Icon name="dice" size={16} />
              <Text style={styles.chipBtnText}>ALEATORIA</Text>
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.modHeader}>
        <Text style={styles.section}>
          MODULACIÓN <Text style={styles.count}>{mods.length}</Text>
        </Text>
        {mods.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: full }}
            disabled={full}
            onPress={add}
            style={({ pressed }) => [styles.chipBtn, full && styles.disabled, pressed && styles.pressed]}
          >
            <Icon name="plus" size={14} />
            <Text style={styles.chipBtnText}>AÑADIR</Text>
          </Pressable>
        )}
      </View>

      {mods.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Haz que la capa se mueva sola con una onda, el ritmo, el azar, el sonido o tu toque"
          onPress={add}
          style={({ pressed }) => [styles.empty, pressed && styles.pressed]}
        >
          <Icon name="plus" size={16} />
          <Text style={styles.emptyTitle}>Añadir modulación</Text>
        </Pressable>
      ) : (
        <View style={styles.cards}>
          {mods.map((r, i) => (
            <ModCard
              key={r.id}
              route={r}
              index={i}
              routes={routes}
              params={def.axes}
              base={layer.params}
              scene={scene}
              mic={mic}
              expanded={expanded === r.id}
              onToggle={() => setExpanded((e) => (e === r.id ? null : r.id))}
            />
          ))}
        </View>
      )}

      {warning && <Text style={styles.warning}>{warning}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: space.xs },
  title: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600", letterSpacing: 1, marginLeft: space.xs },
  section: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2 },
  count: { color: colors.inkMute, fontWeight: "400" },
  sliders: { flexDirection: "row", gap: space.xl },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 32 },
  rowLabel: { width: 62, color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  seed: { flex: 1, color: colors.inkMute, fontFamily: type.family, fontSize: type.label, fontVariant: ["tabular-nums"] },
  modHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xs },
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.inkRaised,
  },
  chipBtnText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.inkLineStrong,
  },
  emptyTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  cards: { gap: space.sm },
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
