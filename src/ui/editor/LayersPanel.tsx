import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { toggleLayerVisible } from "../../actions/sceneEdits";
import type { Layer, Route, SourceConfig } from "../../domain/types";
import { selectFeedback } from "../../platform/haptics";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
import { colors, radius, space, type } from "../tokens";
import { layerDef } from "./LayerInspector";
import { SOURCE_ICON, SOURCE_LABEL } from "./ModCard";
import { GlobalSourcesEditor, type MicView } from "./SourceEditor";

const ROW_THUMB = 44;

type Props = {
  layers: readonly Layer[];
  routes: readonly Route[];
  selectedLayerId: string | null;
  onSelect: (layerId: string) => void;
  renderThumb: (layer: Layer, size: number) => ReactNode;
  renderInspector: (layer: Layer, onBack: () => void) => ReactNode;
  onOpenEffects: () => void;
  sources: SourceConfig;
  onSources: (next: SourceConfig) => void;
  onTempo: (bpm: number) => void;
  mic: MicView;
  // la vista del micrófono está abierta: el medidor necesita el micrófono encendido
  onMicVisible: (visible: boolean) => void;
};

// panel Capas: la pila de la escena como en un editor de video. Cada capa abre su inspector
// (parámetros + modulaciones); arriba, el reloj y el micrófono que comparte toda la escena
export function LayersPanel(props: Props) {
  const { layers, routes, selectedLayerId } = props;
  const [view, setView] = useState<"list" | "layer" | "global">("list");
  const open = view === "layer" ? (layers.find((l) => l.id === selectedLayerId) ?? null) : null;

  const globalOpen = view === "global";
  const { onMicVisible } = props;
  useEffect(() => {
    onMicVisible(globalOpen);
    return () => onMicVisible(false);
  }, [globalOpen, onMicVisible]);

  if (open) return <>{props.renderInspector(open, () => setView("list"))}</>;

  if (globalOpen) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <IconButton icon="chevron.left" label="Volver a las capas" size={34} onPress={() => setView("list")} />
          <Text style={styles.title}>Reloj y micrófono</Text>
        </View>
        <GlobalSourcesEditor sources={props.sources} onSources={props.onSources} onTempo={props.onTempo} mic={props.mic} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.section}>{layers.length === 1 ? "1 CAPA" : `${layers.length} CAPAS`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reloj y micrófono"
          onPress={() => {
            selectFeedback();
            setView("global");
          }}
          style={({ pressed }) => [styles.globalBtn, pressed && styles.pressed]}
        >
          <Icon name="metronome" size={14} />
          <Text style={styles.globalText}>{props.sources.tempo.bpm} BPM</Text>
          <View style={styles.sep} />
          <Icon name="mic" size={14} />
        </Pressable>
      </View>

      {layers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aún no hay capas</Text>
          <Pressable accessibilityRole="button" onPress={props.onOpenEffects} style={({ pressed }) => [styles.globalBtn, pressed && styles.pressed]}>
            <Icon name="wand.and.stars" size={14} />
            <Text style={styles.globalText}>AÑADIR EFECTOS</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {layers.map((layer, i) => {
            const def = layerDef(layer);
            const mods = routes.filter((r) => r.target.layerId === layer.id);
            const selected = layer.id === selectedLayerId;
            return (
              <Pressable
                key={layer.id}
                accessibilityRole="button"
                accessibilityLabel={`Capa ${i + 1}, ${def.label}${mods.length ? `, ${mods.length} modulaciones` : ""}`}
                onPress={() => {
                  selectFeedback();
                  props.onSelect(layer.id);
                  setView("layer");
                }}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
              >
                <View style={[styles.thumb, !layer.visible && styles.hidden]}>{props.renderThumb(layer, ROW_THUMB)}</View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    <Text style={styles.order}>{i + 1} </Text>
                    {def.label}
                    {layer.kind === "generator" ? <Text style={styles.order}> · GENERADOR</Text> : null}
                  </Text>
                  {mods.length > 0 && (
                    <View style={styles.badges}>
                      {mods.map((r) => (
                        <View
                          key={r.id}
                          style={styles.badge}
                          accessible
                          accessibilityLabel={`${SOURCE_LABEL[r.source]} mueve ${def.axes[r.target.param]}`}
                        >
                          <Icon name={SOURCE_ICON[r.source]} size={11} />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <IconButton
                  icon={layer.visible ? "eye" : "eye.slash"}
                  label={layer.visible ? "Ocultar capa" : "Mostrar capa"}
                  size={32}
                  bare
                  onPress={() => toggleLayerVisible(layer.id)}
                />
                <Icon name="chevron.right" size={14} color={colors.inkMute} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600", letterSpacing: 0.6 },
  section: { flex: 1, color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2 },
  count: { color: colors.inkMute, fontWeight: "400" },
  globalBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.inkRaised,
  },
  globalText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1, fontVariant: ["tabular-nums"] },
  sep: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: colors.inkLineStrong },
  pressed: { opacity: 0.6 },
  list: { gap: space.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.inkSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inkLine,
  },
  rowSelected: { borderColor: colors.paper },
  thumb: { width: ROW_THUMB, height: ROW_THUMB, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.inkRaised },
  hidden: { opacity: 0.3 },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600", letterSpacing: 0.8 },
  order: { color: colors.inkMute, fontWeight: "400" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { width: 22, height: 20, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.inkRaised },
  empty: { gap: space.sm, alignItems: "center", padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.inkLineStrong },
  emptyTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
});
