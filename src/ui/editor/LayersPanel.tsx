import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useReducedMotion } from "react-native-reanimated";

import { moveLayer, toggleLayerVisible } from "../../actions/sceneEdits";
import type { Layer, Route, SourceConfig } from "../../domain/types";
import { selectFeedback, tapFeedback } from "../../platform/haptics";
import { confirmDelete } from "../../state/confirm";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
import { SheetScrollLock } from "../kit/Sheet";
import { colors, radius, space, type } from "../tokens";
import { layerDef } from "./LayerInspector";
import { SOURCE_ICON, SOURCE_LABEL } from "./ModCard";
import { GlobalSourcesEditor, type MicView } from "./SourceEditor";

const ROW_THUMB = 44;
// alto fijo de una fila y distancia entre filas (alto + separación): permite calcular el destino
// al arrastrar sin medir
const ROW_H = 60;
const ROW_GAP = 4;
const ROW_STRIDE = ROW_H + ROW_GAP;

type RowProps = {
  layer: Layer;
  index: number;
  count: number;
  mods: Route[];
  selected: boolean;
  // desplazamiento para abrir hueco mientras se arrastra otra fila
  offset: number;
  // desplazamiento del dedo si esta fila se arrastra; null si no
  dragging: number | null;
  thumb: ReactNode;
  onOpen: () => void;
  onDragStart: () => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
  // VoiceOver: subir o bajar una posición
  onMove: (to: number) => void;
  onRemove: () => void;
};

function LayerRow({ layer, index, count, mods, selected, offset, dragging, thumb, onOpen, onDragStart, onDragMove, onDragEnd, onMove, onRemove }: RowProps) {
  const def = layerDef(layer);
  const lifted = dragging !== null;
  const reduced = useReducedMotion();
  // la manija arrastra en el hilo de JS (pocas filas); bloquea el desplazamiento de la hoja
  const pan = Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onStart(onDragStart)
    .onUpdate((e) => onDragMove(e.translationY))
    .onFinalize(onDragEnd);
  return (
    <View style={[styles.rowWrap, { transform: [{ translateY: lifted ? dragging : offset }] }, lifted && styles.rowLifted]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Capa ${index + 1}, ${def.label}${mods.length ? `, ${mods.length} modulaciones` : ""}${layer.visible ? "" : ", oculta"}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.row, selected && styles.rowSelected, lifted && styles.rowDragging, lifted && !reduced && styles.rowGrow, pressed && styles.pressed]}
      >
        <View style={[styles.thumb, !layer.visible && styles.hidden]}>{thumb}</View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, !layer.visible && styles.rowTitleHidden]} numberOfLines={1}>
            <Text style={styles.order}>{index + 1} </Text>
            {def.label}
            {layer.kind === "generator" ? <Text style={styles.order}> · GENERADOR</Text> : null}
          </Text>
          {mods.length > 0 && (
            <View style={styles.badges}>
              {mods.map((r) => (
                <View key={r.id} style={styles.badge} accessible accessibilityLabel={`${SOURCE_LABEL[r.source]} mueve ${def.axes[r.target.param]}`}>
                  <Icon name={SOURCE_ICON[r.source]} size={11} />
                </View>
              ))}
            </View>
          )}
        </View>
        <IconButton
          icon={layer.visible ? "eye" : "eye.slash"}
          label={layer.visible ? "Ocultar capa" : "Mostrar capa"}
          size={36}
          bare
          onPress={() => toggleLayerVisible(layer.id)}
        />
        <IconButton
          icon="trash"
          label={`Quitar ${def.label}`}
          size={36}
          bare
          onPress={() => {
            const n = mods.length;
            void confirmDelete({
              section: "CAPA",
              title: `¿Quitar ${def.label}?`,
              message: n > 0 ? `También se quitan sus ${n === 1 ? "modulación" : `${n} modulaciones`}. Puedes deshacerlo con ↶.` : "Puedes deshacerlo con ↶.",
              label: "Quitar capa",
            }).then((ok) => ok && onRemove());
          }}
        />
        {count > 1 && (
          <GestureDetector gesture={pan}>
            <View
              style={styles.handle}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`Ordenar ${def.label}, posición ${index + 1} de ${count}`}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === "decrement" && index < count - 1) onMove(index + 1);
                if (e.nativeEvent.actionName === "increment" && index > 0) onMove(index - 1);
              }}
            >
              <Icon name="line.3.horizontal" size={16} color={colors.inkMute} />
            </View>
          </GestureDetector>
        )}
      </Pressable>
    </View>
  );
}

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
  onRemove: (layerId: string) => void;
};

// panel Capas: la pila de la escena como en un editor de video. Cada capa abre su inspector
// (parámetros + modulaciones); arriba, el reloj y el micrófono que comparte toda la escena
export function LayersPanel(props: Props) {
  const { layers, routes, selectedLayerId } = props;
  const [view, setView] = useState<"list" | "layer" | "global">("list");
  const open = view === "layer" ? (layers.find((l) => l.id === selectedLayerId) ?? null) : null;

  const globalOpen = view === "global";

  // reordenar arrastrando la manija: la fila sigue al dedo y las demás se apartan para mostrar
  // dónde caerá; al soltar se mueve (un cambio deshacible)
  const lockSheet = useContext(SheetScrollLock);
  const [drag, setDragState] = useState<{ id: string; from: number; dy: number } | null>(null);
  // copia en ref: el fin del gesto lee siempre la última posición, aunque su manejador sea de un
  // render anterior
  const dragRef = useRef(drag);
  const setDrag = (next: typeof drag | ((d: typeof drag) => typeof drag)) => {
    const value = typeof next === "function" ? next(dragRef.current) : next;
    dragRef.current = value;
    setDragState(value);
  };
  const dropIndex = (d: NonNullable<typeof drag>) => Math.min(layers.length - 1, Math.max(0, d.from + Math.round(d.dy / ROW_STRIDE)));
  const target = drag ? dropIndex(drag) : null;
  const shiftFor = (i: number) => {
    if (!drag || target === null || i === drag.from) return 0;
    if (drag.from < target && i > drag.from && i <= target) return -ROW_STRIDE;
    if (target < drag.from && i >= target && i < drag.from) return ROW_STRIDE;
    return 0;
  };
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
        <View style={styles.sectionRow} accessible accessibilityLabel={`${layers.length} capas, se aplican de arriba hacia abajo`}>
          <Text style={styles.sectionText}>{layers.length === 1 ? "1 CAPA" : `${layers.length} CAPAS`}</Text>
          {layers.length > 1 && (
            <>
              <Icon name="arrow.down" size={10} color={colors.inkMute} />
              <Text style={styles.sectionText}>EN ORDEN</Text>
            </>
          )}
        </View>
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
          {layers.map((layer, i) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              index={i}
              count={layers.length}
              mods={routes.filter((r) => r.target.layerId === layer.id)}
              selected={layer.id === selectedLayerId}
              offset={shiftFor(i)}
              dragging={drag?.id === layer.id ? drag.dy : null}
              thumb={props.renderThumb(layer, ROW_THUMB)}
              onRemove={() => props.onRemove(layer.id)}
              onOpen={() => {
                selectFeedback();
                props.onSelect(layer.id);
                setView("layer");
              }}
              onDragStart={() => {
                lockSheet(true);
                tapFeedback();
                setDrag({ id: layer.id, from: i, dy: 0 });
              }}
              onDragMove={(dy) => setDrag((d) => (d ? { ...d, dy } : d))}
              onDragEnd={() => {
                lockSheet(false);
                const d = dragRef.current;
                if (d && dropIndex(d) !== d.from) moveLayer(d.id, dropIndex(d));
                setDrag(null);
              }}
              onMove={(to) => moveLayer(layer.id, to)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600", letterSpacing: 0.6 },
  sectionRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  sectionText: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2 },
  rowWrap: { height: ROW_H },
  rowLifted: { zIndex: 10, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  rowDragging: { backgroundColor: colors.inkRaised },
  // la fila levantada crece un poco (no con "Reducir movimiento")
  rowGrow: { transform: [{ scale: 1.02 }] },
  rowTitleHidden: { color: colors.inkMute, textDecorationLine: "line-through" },
  handle: { width: 36, height: 44, alignItems: "center", justifyContent: "center", marginRight: -space.sm },
  count: { color: colors.inkMute, fontWeight: "400" },
  globalBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.inkRaised,
  },
  globalText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1, fontVariant: ["tabular-nums"] },
  sep: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: colors.inkLineStrong },
  pressed: { opacity: 0.6 },
  list: { gap: ROW_GAP },
  row: {
    flex: 1,
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
