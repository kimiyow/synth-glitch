import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { applySceneVariation } from "../../actions/sceneEdits";
import type { Layer, Route, SourceConfig } from "../../domain/types";
import { mutateScene, newMutationSeed, randomScene, type MutationLevel } from "../../engine/mutate";
import { tapFeedback } from "../../platform/haptics";
import { ActionGrid, type GridAction } from "../kit/ActionGrid";
import { Icon } from "../kit/Icon";
import { Segmented } from "../kit/Segmented";
import { colors, radius, space, type } from "../tokens";

type Props = {
  readOnly: boolean;
  busy: boolean;
  layers: readonly Layer[];
  routes: readonly Route[];
  sources: SourceConfig;
  onImport: () => void;
  onShare: () => void;
  // tras aleatorizar, la capa que queda seleccionada
  onSelect: (layerId: string) => void;
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
export function PresetsPanel({ readOnly, busy, layers, routes, sources, onImport, onShare, onSelect }: Props) {
  const [explore, setExplore] = useState<Explore | null>(null);
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
    { id: "save", icon: "square.stack.3d.up", label: "Guardar escena", reason: "PRONTO" },
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
    </View>
  );
}

const styles = StyleSheet.create({
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
