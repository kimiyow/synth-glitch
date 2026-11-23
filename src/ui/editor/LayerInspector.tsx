import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { addModulation, MAX_MODS_PER_LAYER, rerollSeed, resetLayer, setBlend, toggleLayerVisible } from "../../actions/sceneEdits";
import type { BlendMode, Layer, Route, SourceConfig } from "../../domain/types";
import { EFFECT_BY_ID, GENERATOR_BY_ID } from "../../engine/registry";
import { askConfirm } from "../../state/confirm";
import { selectFeedback, tapFeedback } from "../../platform/haptics";
import { ChipRow, type Chip } from "../ChipRow";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
import { Slider } from "../Slider";
import { colors, radius, space, type } from "../tokens";
import { ModCard, SOURCE_ICON, SOURCE_LABEL } from "./ModCard";
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
  // panel Modulación: solo las modulaciones, con la indicada (o la primera) abierta. fresh = recién
  // creada: se abre eligiendo fuente
  focus?: "mod";
  focusRoute?: { id: string | null; fresh: boolean } | null;
  // fuera del panel Modulación (Capas, Efectos) las modulaciones solo se resumen: tocarlas abre el
  // panel Modulación con esa abierta (null = la primera)
  onOpenMod?: (layerId: string, routeId: string | null, fresh: boolean) => void;
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
  const focusMod = props.focus === "mod";
  // la modulación pedida solo cuenta si es de esta capa (en la lista del panel se puede elegir otra)
  const asked = focusMod && props.focusRoute?.id && mods.some((r) => r.id === props.focusRoute?.id) ? props.focusRoute : null;
  const [expanded, setExpanded] = useState<string | null>(() => (focusMod ? (asked?.id ?? mods[0]?.id ?? null) : null));
  // la última modulación creada se abre eligiendo fuente
  const [fresh, setFresh] = useState<string | null>(() => (asked?.fresh ? asked.id : null));
  // acciones de la capa en la hoja común: restablecer o quitar. La propia hoja es la confirmación
  const openLayerActions = async () => {
    const n = mods.length;
    const id = await askConfirm({
      section: "CAPA",
      title: def.label,
      message: n > 0 ? `Al quitarla también se quitan sus ${n === 1 ? "modulación" : `${n} modulaciones`}. Puedes deshacerlo con ↶.` : "Puedes deshacerlo con ↶.",
      actions: [
        { id: "reset", label: "Restablecer parámetros", icon: "arrow.counterclockwise", variant: "secondary" },
        { id: "remove", label: "Quitar capa", icon: "trash", variant: "primary" },
      ],
    });
    if (id === "reset") resetLayer(layer.id);
    if (id === "remove") {
      props.onRemove(layer.id);
      props.onBack();
    }
  };

  // modulaciones que tocan un eje (el gesto y el giro mueven los dos)
  const onAxis = (axis: "x" | "y") =>
    mods.filter((r) => (r.target.param === axis || r.source === "track") && r.amount !== 0);
  // con intensidad 1 en reemplazo, la fuente manda y el valor del usuario no cambia nada
  const lockedBy = (axis: "x" | "y") => onAxis(axis).find((r) => r.mode === "replace" && r.amount >= 0.99) ?? null;

  const add = () => {
    const xCount = mods.filter((r) => r.target.param === "x").length;
    const yCount = mods.length - xCount;
    const id = addModulation(routes, layer.id, xCount <= yCount ? "x" : "y");
    if (!id) return props.onNotice(`MÁXIMO ${MAX_MODS_PER_LAYER} MODULACIONES POR CAPA`);
    tapFeedback();
    // fuera del panel Modulación, la nueva se edita allí
    if (!focusMod && props.onOpenMod) return props.onOpenMod(layer.id, id, true);
    setExpanded(id);
    setFresh(id);
  };
  const full = mods.length >= MAX_MODS_PER_LAYER;
  // fuera del panel Modulación: resumen de una línea por modulación; editar se hace en el panel
  const summary = !focusMod && props.onOpenMod !== undefined;
  const openMod = (routeId: string | null) => {
    selectFeedback();
    props.onOpenMod?.(layer.id, routeId, false);
  };
  const percent = (v: number) => `${Math.round(v * 100)} %`;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon="chevron.left" label="Volver" bare onPress={props.onBack} />
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {def.label}
        </Text>
        <IconButton
          icon={layer.visible ? "eye" : "eye.slash"}
          label={layer.visible ? "Ocultar capa" : "Mostrar capa"}
          active={!layer.visible}
          onPress={() => toggleLayerVisible(layer.id)}
        />
        {/* salida rápida: quitar la capa sin preguntar (se deshace con ↶) */}
        <IconButton
          icon="trash"
          label={`Quitar ${def.label}`}
          onPress={() => {
            props.onRemove(layer.id);
            props.onBack();
            props.onNotice(`${def.label.toUpperCase()} QUITADO · ↶ PARA DESHACER`);
          }}
        />
        <IconButton icon="ellipsis" label="Acciones de la capa" onPress={() => void openLayerActions()} />
      </View>

      {!focusMod && (
      <View style={styles.sliders}>
        {(["x", "y"] as const).map((axis) => {
          return (
            <View key={axis} style={styles.flex}>
              <Slider
                label={def.axes[axis]}
                badge={lockedBy(axis) ? "lock.fill" : onAxis(axis).length > 0 ? "waveform.path" : undefined}
                value={layer.params[axis]}
                onSlidingStart={() => {
                  const lock = lockedBy(axis);
                  if (lock) props.onNotice(`${SOURCE_LABEL[lock.source]} CONTROLA ${def.axes[axis].toUpperCase()} · BAJA SU INTENSIDAD`);
                  props.onParamStart(layer.id);
                }}
                onChange={(v) => props.onParam(layer.id, axis, Math.round(v * 1000) / 1000)}
                onSlidingEnd={() => props.onParamEnd(layer.id)}
              />
            </View>
          );
        })}
      </View>

      )}

      {!focusMod && layer.kind === "generator" && (
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
              hitSlop={{ top: 7, bottom: 7 }}
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
          MODULACIÓN <Text style={styles.count}>{mods.length}/{MAX_MODS_PER_LAYER}</Text>
        </Text>
        {mods.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: full }}
            disabled={full}
            onPress={add}
            hitSlop={{ top: 7, bottom: 7 }}
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
      ) : summary ? (
        <View style={styles.cards}>
          {mods.map((r) => {
            const param = r.source === "track" ? `${def.axes.x} + ${def.axes.y}` : def.axes[r.target.param];
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${SOURCE_LABEL[r.source]} mueve ${param}, intensidad ${percent(r.amount)}`}
                accessibilityHint="Abre esta modulación en el panel Modulación"
                onPress={() => openMod(r.id)}
                style={({ pressed }) => [styles.modRow, pressed && styles.pressed]}
              >
                <Icon name={SOURCE_ICON[r.source]} size={14} />
                <Text style={styles.modRowTitle} numberOfLines={1}>
                  {SOURCE_LABEL[r.source]} <Text style={styles.count}>→</Text> {param}
                </Text>
                <Text style={styles.modRowAmount}>{percent(r.amount)}</Text>
                <Icon name="chevron.right" size={12} color={colors.inkMute} />
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={() => openMod(null)}
            style={({ pressed }) => [styles.chipBtn, styles.editMods, pressed && styles.pressed]}
          >
            <Icon name="waveform.path" size={14} />
            <Text style={styles.chipBtnText}>EDITAR EN MODULACIÓN</Text>
          </Pressable>
        </View>
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
              fresh={fresh === r.id}
              onToggle={() => setExpanded((e) => (e === r.id ? null : r.id))}
              onNotice={props.onNotice}
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
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, marginLeft: -space.sm },
  title: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600", letterSpacing: 1, marginLeft: space.xs },
  section: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2 },
  count: { color: colors.inkMute, fontWeight: "400" },
  sliders: { flexDirection: "row", gap: space.xl },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 32 },
  rowLabel: { width: 62, color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  seed: { flex: 1, color: colors.inkMute, fontFamily: type.family, fontSize: type.label, fontVariant: ["tabular-nums"] },
  modRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.inkSurface,
  },
  modRowTitle: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600", letterSpacing: 0.6 },
  modRowAmount: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, fontVariant: ["tabular-nums"] },
  editMods: { alignSelf: "center", marginTop: space.xs },
  modHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xs },
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    minHeight: 30,
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
