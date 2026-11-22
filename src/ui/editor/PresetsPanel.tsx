import type { SkImage } from "@shopify/react-native-skia";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  findSameScene,
  MAX_SCENE_NAME,
  removeScenePreset,
  renameScenePreset,
  saveScenePreset,
  updateScenePreset,
} from "../../actions/scenePresets";
import { applySceneVariation } from "../../actions/sceneEdits";
import type { Layer, Route, ScenePreset, SourceConfig } from "../../domain/types";
import { FACTORY_PRESETS } from "../../engine/factoryPresets";
import { mutateScene, newMutationSeed, randomScene, type MutationLevel } from "../../engine/mutate";
import { selectFeedback, tapFeedback } from "../../platform/haptics";
import { SceneThumb } from "../../render/EffectThumb";
import { settingsStore, useSettings } from "../../state/appSettings";
import { askConfirm, confirmDelete } from "../../state/confirm";
import { MAX_SCENE_PRESETS, type SceneFadeBeats } from "../../state/settings";
import { announce } from "../errors";
import { ActionGrid, type GridAction } from "../kit/ActionGrid";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
import { Segmented } from "../kit/Segmented";
import { useRevealOnFocus } from "../kit/Sheet";
import { colors, COMPACT_FONT_SCALE, radius, space, type } from "../tokens";
import { layerDef } from "./LayerInspector";
import { SOURCE_ICON } from "./ModCard";

type Props = {
  readOnly: boolean;
  busy: boolean;
  // imagen del proyecto, para la miniatura de cada escena
  image: SkImage | null;
  seed: number;
  layers: readonly Layer[];
  routes: readonly Route[];
  sources: SourceConfig;
  onImport: () => void;
  onShare: () => void;
  // tras aleatorizar, la capa que queda seleccionada
  onSelect: (layerId: string) => void;
  onNotice: (text: string) => void;
  // aplica la escena con la transición elegida (fundido al pulso o corte)
  onTriggerScene: (preset: ScenePreset) => void;
};

type ExploreAction = "import" | "share" | "mutate" | "random";

const FADE_OPTIONS: { id: SceneFadeBeats; label: string }[] = [
  { id: 0, label: "Corte" },
  { id: 1, label: "1 tiempo" },
  { id: 2, label: "2 tiempos" },
  { id: 4, label: "4 tiempos" },
];

const LEVELS: { id: MutationLevel; label: string }[] = [
  { id: "subtle", label: "SUTIL" },
  { id: "medium", label: "MEDIA" },
  { id: "strong", label: "FUERTE" },
];

const GAP = space.sm;
// miniatura 4:3 dentro de cada tarjeta
const THUMB_RATIO = 0.75;

// exploración en curso: MUTAR parte siempre de la misma escena (base) para que cada variación sea
// una alternativa y no una deriva; ALEATORIZAR crea una escena nueva en cada toque
type Explore = { kind: "mutate"; base: { layers: Layer[]; routes: Route[] }; seed: number; level: MutationLevel } | { kind: "random"; seed: number };

// panel Escenas: la transición, guardar la escena actual, las escenas propias y de fábrica con su
// miniatura (la activa marcada) y, abajo, explorar (mutar, aleatorizar, recetas .synthfx)
export function PresetsPanel(props: Props) {
  const { readOnly, busy, image, seed, layers, routes, sources, onImport, onShare, onSelect, onNotice, onTriggerScene } = props;
  const [explore, setExplore] = useState<Explore | null>(null);
  const [width, setWidth] = useState(0);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const userScenes = useSettings((s) => s.scenes);
  const sceneFade = useSettings((s) => s.sceneFade);
  const bpm = sources.tempo.bpm;
  // la escena guardada que se ve ahora: se marca en su tarjeta y no se puede guardar otra vez
  const active = findSameScene([...FACTORY_PRESETS, ...userScenes], layers, routes);
  // 2 columnas en iPhone y en la tarjeta lateral del iPad; 3 en el panel ancho del iPad vertical
  const columns = width >= 520 ? 3 : 2;
  const cardW = width > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) : 0;

  const apply = (p: ScenePreset) => {
    if (readOnly) return;
    selectFeedback();
    setExplore(null);
    onTriggerScene(p);
  };

  const mutate = (base: { layers: Layer[]; routes: Route[] }, mutationSeed: number, level: MutationLevel) => {
    applySceneVariation(mutateScene(base.layers, base.routes, mutationSeed, level, bpm), `mutar · ${mutationSeed}`);
    announce(`VARIACIÓN APLICADA · SEMILLA ${mutationSeed}`);
    setExplore({ kind: "mutate", base, seed: mutationSeed, level });
  };
  const randomize = (mutationSeed: number) => {
    const next = randomScene(mutationSeed, sources);
    applySceneVariation(next, `aleatorizar · ${mutationSeed}`);
    announce(`ESCENA NUEVA · SEMILLA ${mutationSeed}`);
    const last = next.layers.at(-1);
    if (last) onSelect(last.id);
    setExplore({ kind: "random", seed: mutationSeed });
  };

  const save = () => {
    const r = saveScenePreset(layers, routes, sources, FACTORY_PRESETS);
    onNotice(
      r.kind === "saved"
        ? `${r.name.toUpperCase()} GUARDADA · TOCA SU NOMBRE PARA RENOMBRARLA`
        : r.kind === "exists"
          ? `YA ESTÁ GUARDADA · ${r.name.toUpperCase()}`
          : "BIBLIOTECA LLENA · BORRA UNA ESCENA",
    );
  };

  const finishRename = () => {
    if (editing) renameScenePreset(editing.id, editing.text);
    setEditing(null);
  };

  const openMenu = async (p: ScenePreset) => {
    const id = await askConfirm({
      section: "ESCENA",
      title: p.name,
      message: "Actualizar la reemplaza por lo que ves ahora (capas y modulaciones). Borrarla no cambia tu proyecto.",
      actions: [
        { id: "update", label: "Actualizar con lo actual", icon: "arrow.triangle.2.circlepath", variant: "secondary" },
        { id: "delete", label: "Borrar escena", icon: "trash", variant: "primary" },
      ],
    });
    if (id === "update") {
      if (layers.length === 0) return onNotice("SIN CAPAS · NADA QUE GUARDAR");
      updateScenePreset(p.id, layers, routes, sources);
      onNotice(`${p.name.toUpperCase()} ACTUALIZADA`);
    }
    if (id === "delete") {
      const ok = await confirmDelete({
        section: "ESCENAS",
        title: `¿Borrar «${p.name}»?`,
        message: "La escena se borra de tu biblioteca. No se puede deshacer.",
        label: "Borrar escena",
      });
      if (ok) removeScenePreset(p.id);
    }
  };

  // por qué no se puede guardar ahora; null = se puede
  const saveReason = readOnly
    ? "Solo lectura"
    : layers.length === 0
      ? "Añade efectos para guardar una escena"
      : active
        ? `Ya está guardada · ${active.name}`
        : userScenes.length >= MAX_SCENE_PRESETS
          ? "Biblioteca llena · borra una escena"
          : null;

  const exploreActions: GridAction<ExploreAction>[] = [
    { id: "mutate", icon: "wand.and.rays", label: "Mutar", reason: readOnly ? "SOLO LECTURA" : layers.length === 0 ? "SIN CAPAS" : null },
    { id: "random", icon: "dice", label: "Aleatorizar", reason: readOnly ? "SOLO LECTURA" : null },
    { id: "import", icon: "square.and.arrow.down", label: "Importar receta", reason: readOnly ? "SOLO LECTURA" : null },
    { id: "share", icon: "square.and.arrow.up", label: "Compartir receta" },
  ];

  const card = (p: ScenePreset) => (
    <SceneCard
      key={p.id}
      preset={p}
      width={cardW}
      image={image}
      seed={seed}
      active={active?.id === p.id}
      disabled={readOnly || busy}
      editing={editing?.id === p.id ? editing.text : null}
      onApply={() => apply(p)}
      onStartRename={p.builtIn || readOnly ? undefined : () => setEditing({ id: p.id, text: p.name })}
      onRenameText={(text) => setEditing({ id: p.id, text })}
      onFinishRename={finishRename}
      onMenu={p.builtIn || readOnly ? undefined : () => void openMenu(p)}
    />
  );

  return (
    <View style={styles.root} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Text style={styles.intro}>
        Una escena guarda tus capas y modulaciones. Tócala para cambiar a ella; tócala otra vez para quitarla y volver a como estaba.
      </Text>

      <View style={styles.group}>
        <Text style={styles.label}>TRANSICIÓN AL CAMBIAR</Text>
        <Segmented options={FADE_OPTIONS} value={sceneFade} onChange={(b) => settingsStore.getState().update({ sceneFade: b })} />
        <Text style={styles.note}>
          {sceneFade === 0 ? "Cambia de golpe." : `Funde en ${sceneFade} ${sceneFade === 1 ? "tiempo" : "tiempos"} del reloj (${bpm} BPM).`}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saveReason !== null }}
        disabled={saveReason !== null || busy}
        onPress={() => {
          tapFeedback();
          save();
        }}
        style={({ pressed }) => [styles.save, saveReason !== null && styles.saveOff, pressed && styles.pressed]}
      >
        <Icon name={active ? "checkmark" : "plus"} size={15} color={saveReason !== null ? colors.inkText : colors.paperText} />
        <Text style={[styles.saveText, saveReason !== null && styles.saveTextOff]} numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
          {saveReason ?? "Guardar escena actual"}
        </Text>
      </Pressable>

      <Text style={styles.section}>
        MIS ESCENAS <Text style={styles.count}>{userScenes.length}/{MAX_SCENE_PRESETS}</Text>
      </Text>
      {userScenes.length === 0 ? (
        <Text style={styles.note}>Aún no tienes escenas. Arma tus capas y toca «Guardar escena actual».</Text>
      ) : (
        cardW > 0 && <View style={styles.grid}>{userScenes.map(card)}</View>
      )}

      <Text style={styles.section}>DE FÁBRICA</Text>
      {cardW > 0 && <View style={styles.grid}>{FACTORY_PRESETS.map(card)}</View>}

      <Text style={styles.section}>EXPLORAR</Text>
      <ActionGrid
        actions={exploreActions}
        disabled={busy}
        onPress={(id) => {
          if (id === "import") onImport();
          if (id === "share") onShare();
          if (id === "mutate") mutate({ layers: [...layers], routes: [...routes] }, newMutationSeed(), explore?.kind === "mutate" ? explore.level : "medium");
          if (id === "random") randomize(newMutationSeed());
        }}
      />

      {explore && (
        <View style={styles.explore}>
          <Text style={styles.section}>
            {explore.kind === "mutate" ? "MUTAR" : "ALEATORIO"} <Text style={styles.count}>· SEMILLA {explore.seed}</Text>
          </Text>
          {explore.kind === "mutate" && (
            <Segmented options={LEVELS} value={explore.level} onChange={(level) => mutate(explore.base, explore.seed, level)} />
          )}
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityHint={explore.kind === "mutate" ? "Otra variación de la misma escena" : "Otra escena al azar"}
              onPress={() => {
                tapFeedback();
                if (explore.kind === "mutate") mutate(explore.base, newMutationSeed(), explore.level);
                else randomize(newMutationSeed());
              }}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Icon name="arrow.triangle.2.circlepath" size={14} color={colors.paperText} />
              <Text style={styles.primaryText}>{explore.kind === "mutate" ? "OTRA VARIACIÓN" : "OTRA ESCENA"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setExplore(null)} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Icon name="checkmark" size={14} />
              <Text style={styles.secondaryText}>LISTO</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// tarjeta de una escena: miniatura sobre la imagen del proyecto, nombre (tocar para renombrar las
// propias), sus modulaciones y el menú ⋯. Tocar la miniatura cambia a la escena
function SceneCard(props: {
  preset: ScenePreset;
  width: number;
  image: SkImage | null;
  seed: number;
  active: boolean;
  disabled: boolean;
  editing: string | null;
  onApply: () => void;
  onStartRename?: () => void;
  onRenameText: (text: string) => void;
  onFinishRename: () => void;
  onMenu?: () => void;
}) {
  const { preset, width, active } = props;
  const { ref: revealRef, onFocus: revealOnFocus } = useRevealOnFocus();
  const thumbH = Math.round(width * THUMB_RATIO);
  const effects = preset.layers.map((l) => layerDef(l).label).join(" + ");
  return (
    <View style={[styles.card, { width }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${preset.name}: ${effects}${active ? ", activa" : ""}`}
        accessibilityHint={active ? "Quita la escena y vuelve a como estaba" : "Cambia a esta escena"}
        accessibilityState={{ selected: active, disabled: props.disabled }}
        disabled={props.disabled}
        onPress={props.onApply}
        style={({ pressed }) => [styles.thumb, { height: thumbH }, active && styles.thumbActive, props.disabled && styles.off, pressed && styles.pressed]}
      >
        <SceneThumb image={props.image} layers={preset.layers} seed={props.seed} width={width - 8} height={thumbH - 8} />
        {active && (
          <View style={styles.activeBadge}>
            <Icon name="checkmark" size={10} color={colors.paperText} />
            <Text style={styles.activeText}>ACTIVA</Text>
          </View>
        )}
        {preset.routes.length > 0 && (
          <View style={styles.mods}>
            {preset.routes.slice(0, 4).map((r) => (
              <Icon key={r.id} name={SOURCE_ICON[r.source]} size={10} color={colors.inkText} />
            ))}
          </View>
        )}
      </Pressable>
      <View style={styles.cardFooter} ref={revealRef} collapsable={false}>
        {props.editing !== null ? (
          <TextInput
            value={props.editing}
            onChangeText={props.onRenameText}
            onEndEditing={props.onFinishRename}
            onSubmitEditing={props.onFinishRename}
            onFocus={revealOnFocus}
            autoFocus
            selectTextOnFocus
            maxLength={MAX_SCENE_NAME}
            returnKeyType="done"
            accessibilityLabel={`Nombre de ${preset.name}`}
            style={[styles.name, styles.nameInput]}
          />
        ) : (
          <Pressable
            accessibilityRole={props.onStartRename ? "button" : "text"}
            accessibilityLabel={props.onStartRename ? `${preset.name}. Toca para renombrar` : preset.name}
            disabled={!props.onStartRename}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={props.onStartRename}
            style={styles.nameRow}
          >
            <Text style={styles.name} numberOfLines={1}>
              {preset.name}
            </Text>
            {props.onStartRename && <Icon name="pencil" size={10} color={colors.inkMute} />}
          </Pressable>
        )}
        {props.onMenu && <IconButton icon="ellipsis" label={`Opciones de ${preset.name}`} size={28} bare onPress={props.onMenu} />}
      </View>
      <Text style={styles.fx} numberOfLines={1}>
        {effects}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  intro: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, lineHeight: 18 },
  group: { gap: space.sm },
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1.2 },
  note: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, lineHeight: 17 },
  save: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  saveOff: { backgroundColor: colors.inkRaised },
  saveText: { flexShrink: 1, color: colors.paperText, fontFamily: type.family, fontSize: type.body - 1, fontWeight: "600" },
  saveTextOff: { color: colors.inkText },
  section: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2, marginTop: space.xs },
  count: { color: colors.inkMute, fontWeight: "400", fontVariant: ["tabular-nums"] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  card: { gap: 4 },
  thumb: {
    padding: 2,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.inkRaised,
    overflow: "hidden",
  },
  thumbActive: { borderColor: colors.paper },
  activeBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    minHeight: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
  },
  activeText: { color: colors.paperText, fontFamily: type.family, fontSize: type.micro, fontWeight: "700", letterSpacing: 0.8 },
  mods: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 28 },
  nameRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  nameInput: { flex: 1, paddingVertical: 2, paddingHorizontal: 6, marginLeft: -6, borderRadius: radius.sm, backgroundColor: colors.inkRaised },
  fx: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.4, marginTop: -4 },
  off: { opacity: 0.45 },
  explore: { gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.inkSurface },
  row: { flexDirection: "row", gap: space.sm },
  primary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  primaryText: { color: colors.paperText, fontFamily: type.family, fontSize: type.label, fontWeight: "700", letterSpacing: 1 },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
  },
  secondaryText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, letterSpacing: 1 },
  pressed: { opacity: 0.7 },
});
