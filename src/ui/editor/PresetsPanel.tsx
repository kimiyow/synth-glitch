import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { applyScenePreset, removeScenePreset, saveScenePreset } from "../../actions/scenePresets";
import { applySceneVariation } from "../../actions/sceneEdits";
import type { Layer, Route, ScenePreset, SourceConfig } from "../../domain/types";
import { FACTORY_PRESETS } from "../../engine/factoryPresets";
import { mutateScene, newMutationSeed, randomScene, type MutationLevel } from "../../engine/mutate";
import { selectFeedback, tapFeedback } from "../../platform/haptics";
import { useSettings } from "../../state/appSettings";
import { MAX_SCENE_PRESETS } from "../../state/settings";
import { ActionGrid, type GridAction } from "../kit/ActionGrid";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
import { Segmented } from "../kit/Segmented";
import { colors, radius, space, type } from "../tokens";
import { layerDef } from "./LayerInspector";
import { SOURCE_ICON } from "./ModCard";

type Props = {
  readOnly: boolean;
  busy: boolean;
  layers: readonly Layer[];
  routes: readonly Route[];
  sources: SourceConfig;
  onImport: () => void;
  onShare: () => void;
  // tras aleatorizar o aplicar un preset, la capa que queda seleccionada
  onSelect: (layerId: string) => void;
  onNotice: (text: string) => void;
};

type PresetAction = "import" | "share" | "save" | "mutate" | "random";

const LEVELS: { id: MutationLevel; label: string }[] = [
  { id: "subtle", label: "SUTIL" },
  { id: "medium", label: "MEDIA" },
  { id: "strong", label: "FUERTE" },
];

// exploración en curso: MUTAR parte siempre de la misma escena (base) para que cada variación sea
// una alternativa y no una deriva; ALEATORIZAR crea una escena nueva en cada toque
type Explore = { kind: "mutate"; base: { layers: Layer[]; routes: Route[] }; seed: number; level: MutationLevel } | { kind: "random"; seed: number };

// panel Presets: recetas .synthfx y exploración (mutar, aleatorizar). Cada variación es un cambio
// deshacible y muestra su semilla
export function PresetsPanel({ readOnly, busy, layers, routes, sources, onImport, onShare, onSelect, onNotice }: Props) {
  const [explore, setExplore] = useState<Explore | null>(null);
  const userScenes = useSettings((s) => s.scenes);
  const apply = (p: ScenePreset) => {
    if (readOnly) return;
    selectFeedback();
    const last = applyScenePreset(p);
    if (last) onSelect(last);
    setExplore(null);
    onNotice(`${p.name.toUpperCase()} APLICADO`);
  };
  const bpm = sources.tempo.bpm;

  const mutate = (base: { layers: Layer[]; routes: Route[] }, seed: number, level: MutationLevel) => {
    applySceneVariation(mutateScene(base.layers, base.routes, seed, level, bpm), `mutar · ${seed}`);
    setExplore({ kind: "mutate", base, seed, level });
  };
  const randomize = (seed: number) => {
    const next = randomScene(seed, sources);
    applySceneVariation(next, `aleatorizar · ${seed}`);
    const last = next.layers.at(-1);
    if (last) onSelect(last.id);
    setExplore({ kind: "random", seed });
  };

  const actions: GridAction<PresetAction>[] = [
    { id: "import", icon: "square.and.arrow.down", label: "Importar receta", reason: readOnly ? "SOLO LECTURA" : null },
    { id: "share", icon: "square.and.arrow.up", label: "Compartir receta" },
    { id: "mutate", icon: "wand.and.rays", label: "Mutar", reason: readOnly ? "SOLO LECTURA" : layers.length === 0 ? "SIN CAPAS" : null },
    { id: "random", icon: "dice", label: "Aleatorizar", reason: readOnly ? "SOLO LECTURA" : null },
    {
      id: "save",
      icon: "square.stack.3d.up",
      label: "Guardar escena",
      reason: readOnly ? "SOLO LECTURA" : layers.length === 0 ? "SIN CAPAS" : userScenes.length >= MAX_SCENE_PRESETS ? "LLENA" : null,
    },
  ];

  return (
    <View style={styles.root}>
      <ActionGrid
        actions={actions}
        disabled={busy}
        onPress={(id) => {
          if (id === "import") onImport();
          if (id === "share") onShare();
          if (id === "mutate") mutate({ layers: [...layers], routes: [...routes] }, newMutationSeed(), explore?.kind === "mutate" ? explore.level : "medium");
          if (id === "random") randomize(newMutationSeed());
          if (id === "save") {
            const name = saveScenePreset(layers, routes, sources);
            onNotice(name ? `${name.toUpperCase()} GUARDADA` : "BIBLIOTECA LLENA · BORRA UNA ESCENA");
          }
        }}
      />

      {explore && (
        <View style={styles.explore}>
          <Text style={styles.section}>
            {explore.kind === "mutate" ? "MUTAR" : "ALEATORIO"} <Text style={styles.seed}>· SEMILLA {explore.seed}</Text>
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

      <Text style={styles.section}>
        ESCENAS <Text style={styles.seed}>{userScenes.length}/{MAX_SCENE_PRESETS}</Text>
      </Text>
      <View style={styles.list}>
        {[...FACTORY_PRESETS, ...userScenes].map((p) => (
          <SceneRow key={p.id} preset={p} disabled={readOnly || busy} onApply={() => apply(p)} onDelete={p.builtIn ? undefined : () => removeScenePreset(p.id)} />
        ))}
      </View>
    </View>
  );
}

// fila de un preset: nombre, sus efectos y los iconos de sus modulaciones. Tocar la aplica
function SceneRow({ preset, disabled, onApply, onDelete }: { preset: ScenePreset; disabled: boolean; onApply: () => void; onDelete?: () => void }) {
  const effects = preset.layers.map((l) => layerDef(l).label).join(" + ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${preset.name}: ${effects}${preset.builtIn ? ", de fábrica" : ""}`}
      accessibilityHint="Reemplaza las capas de la escena"
      disabled={disabled}
      onPress={onApply}
      style={({ pressed }) => [styles.sceneRow, disabled && styles.off, pressed && styles.pressed]}
    >
      <View style={styles.sceneText}>
        <Text style={styles.sceneName} numberOfLines={1}>
          {preset.name}
          {preset.builtIn ? <Text style={styles.seed}> · DE FÁBRICA</Text> : null}
        </Text>
        <Text style={styles.sceneFx} numberOfLines={1}>
          {effects}
        </Text>
      </View>
      <View style={styles.sceneMods}>
        {preset.routes.slice(0, 4).map((r) => (
          <Icon key={r.id} name={SOURCE_ICON[r.source]} size={11} color={colors.inkMute} />
        ))}
      </View>
      {onDelete && <IconButton icon="trash" label={`Borrar ${preset.name}`} size={32} bare onPress={onDelete} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  sceneRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.inkSurface },
  sceneText: { flex: 1, gap: 2 },
  sceneName: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  sceneFx: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.6 },
  sceneMods: { flexDirection: "row", gap: 4 },
  off: { opacity: 0.45 },
  root: { gap: space.md },
  explore: { gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.inkSurface },
  section: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2 },
  seed: { color: colors.inkMute, fontWeight: "400", fontVariant: ["tabular-nums"] },
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
