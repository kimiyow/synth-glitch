import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useReducedMotion } from "react-native-reanimated";

import { clearPaint, moveLayer, toggleLayerVisible, togglePaintVisible } from "../../actions/sceneEdits";
import type { Layer, PaintLayer, Route, SourceConfig } from "../../domain/types";
import { hasPaint, PAINT_ROW_ID, stackIds } from "../../paint/paintStack";
import { selectFeedback, tapFeedback } from "../../platform/haptics";
import { askConfirm } from "../../state/confirm";
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
const PAINT_NO_MOD = "LA MODULACIÓN ES SOLO PARA EFECTOS, NO PARA LA PINTURA";

type RowProps = {
  label: string;
  // texto tenue tras el nombre (GENERADOR, n TRAZOS)
  suffix: string | null;
  visible: boolean;
  index: number;
  count: number;
  // insignias de modulación
  badges: ReactNode;
  a11yExtra: string;
  // aviso al quitar (se deshace con ↶)
  removed: string;
  selected: boolean;
  // desplazamiento para abrir hueco mientras se arrastra otra fila
  offset: number;
  // desplazamiento del dedo si esta fila se arrastra; null si no
  dragging: number | null;
  thumb: ReactNode;
  onOpen: () => void;
  onToggleVisible: () => void;
  onDragStart: () => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
  // VoiceOver: subir o bajar una posición
  onMove: (to: number) => void;
  onRemove: () => void;
};

// fila de la pila: una capa de efecto o generador, o la capa PINTURA
function StackRow(props: RowProps) {
  const { label, suffix, visible, index, count, selected, offset, dragging, thumb, onOpen, onDragStart, onDragMove, onDragEnd, onMove } = props;
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
        accessibilityLabel={`Capa ${index + 1}, ${label}${props.a11yExtra}${visible ? "" : ", oculta"}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.row, selected && styles.rowSelected, lifted && styles.rowDragging, lifted && !reduced && styles.rowGrow, pressed && styles.pressed]}
      >
        <View style={[styles.thumb, !visible && styles.hidden]}>{thumb}</View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, !visible && styles.rowTitleHidden]} numberOfLines={1}>
            <Text style={styles.order}>{index + 1} </Text>
            {label}
            {suffix ? <Text style={styles.order}> · {suffix}</Text> : null}
          </Text>
          {props.badges}
        </View>
        <IconButton icon={visible ? "eye" : "eye.slash"} label={visible ? "Ocultar capa" : "Mostrar capa"} size={36} bare onPress={props.onToggleVisible} />
        <IconButton
          icon="trash"
          label={`Quitar ${label}`}
          size={36}
          bare
          onPress={props.onRemove}
        />
        {count > 1 && (
          <GestureDetector gesture={pan}>
            <View
              style={styles.handle}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`Ordenar ${label}, posición ${index + 1} de ${count}`}
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

function layerRowInfo(layer: Layer, mods: Route[]) {
  const def = layerDef(layer);
  const n = mods.length;
  return {
    label: def.label,
    suffix: layer.kind === "generator" ? "GENERADOR" : null,
    a11yExtra: n ? `, ${n} modulaciones` : "",
    removed: `${def.label.toUpperCase()} QUITADO · ↶ PARA DESHACER`,
    badges:
      n > 0 ? (
        <View style={styles.badges}>
          {mods.map((r) => (
            <View key={r.id} style={styles.badge} accessible accessibilityLabel={`${SOURCE_LABEL[r.source]} mueve ${def.axes[r.target.param]}`}>
              <Icon name={SOURCE_ICON[r.source]} size={11} />
            </View>
          ))}
        </View>
      ) : null,
  };
}

// en Modulación la fila avisa que la pintura no se modula
function paintRowInfo(strokes: number, modulation: boolean) {
  const trazos = strokes === 1 ? "1 TRAZO" : `${strokes} TRAZOS`;
  return {
    label: "PINTURA",
    suffix: modulation ? "SIN MODULACIÓN" : trazos,
    a11yExtra: `, ${trazos.toLowerCase()}`,
    removed: "PINTURA BORRADA · ↶ PARA DESHACER",
    badges: null,
  };
}

type Props = {
  layers: readonly Layer[];
  // capa PINTURA (trazos del pincel); su fila aparece si tiene trazos
  paint: PaintLayer;
  onOpenBrush: () => void;
  onNotice: (text: string) => void;
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
  // atajo Modulación: abre directo la capa seleccionada
  startInLayer?: boolean;
};

// panel Capas: la pila de la escena como en un editor de video. Cada capa abre su inspector
// (parámetros + modulaciones); arriba, el reloj y el micrófono que comparte toda la escena
export function LayersPanel(props: Props) {
  const { layers, routes, selectedLayerId, paint } = props;
  // filas en orden de aplicación: las capas y, en su lugar, la pintura
  const rows = stackIds(layers, paint);
  const [view, setView] = useState<"list" | "layer" | "global">(() => (props.startInLayer && selectedLayerId ? "layer" : "list"));
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
  const dropIndex = (d: NonNullable<typeof drag>) => Math.min(rows.length - 1, Math.max(0, d.from + Math.round(d.dy / ROW_STRIDE)));
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

  // + AÑADIR CAPA: un efecto o generador (panel Efectos) o la PINTURA (pincel). La pintura es una
  // sola capa: si ya existe, el pincel sigue pintando en ella
  const addLayer = () => {
    selectFeedback();
    void askConfirm({
      section: "CAPAS",
      title: "Añadir capa",
      message: hasPaint(paint) ? "La pintura es una sola capa: el pincel sigue pintando en PINTURA." : "La capa PINTURA aparece con tu primer trazo.",
      actions: [
        { id: "effect", label: "Efecto o generador", icon: "wand.and.stars", variant: "primary" },
        { id: "paint", label: hasPaint(paint) ? "Pintar en PINTURA" : "Pintura", icon: "paintbrush.pointed", variant: "secondary" },
      ],
    }).then((id) => {
      if (id === "effect") props.onOpenEffects();
      if (id === "paint") props.onOpenBrush();
    });
  };
  const addButton = (
    <Pressable accessibilityRole="button" hitSlop={{ top: 6, bottom: 6 }} onPress={addLayer} style={({ pressed }) => [styles.globalBtn, pressed && styles.pressed]}>
      <Icon name="plus" size={14} />
      <Text style={styles.globalText}>AÑADIR CAPA</Text>
    </Pressable>
  );

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
        <View style={styles.sectionRow} accessible accessibilityLabel={`${rows.length} capas, se aplican de arriba hacia abajo`}>
          <Text style={styles.sectionText}>{rows.length === 1 ? "1 CAPA" : `${rows.length} CAPAS`}</Text>
          {rows.length > 1 && (
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
          hitSlop={{ top: 6, bottom: 6 }}
          style={({ pressed }) => [styles.globalBtn, pressed && styles.pressed]}
        >
          <Icon name="metronome" size={14} />
          <Text style={styles.globalText}>{props.sources.tempo.bpm} BPM</Text>
          <View style={styles.sep} />
          <Icon name="mic" size={14} />
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aún no hay capas</Text>
          {addButton}
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((id, i) => {
            const layer = layers.find((l) => l.id === id);
            if (!layer && id !== PAINT_ROW_ID) return null;
            const mods = layer ? routes.filter((r) => r.target.layerId === layer.id) : [];
            const info = layer ? layerRowInfo(layer, mods) : paintRowInfo(paint.strokes.length, props.startInLayer === true);
            return (
              <StackRow
                key={id}
                {...info}
                visible={layer ? layer.visible : paint.visible}
                index={i}
                count={rows.length}
                selected={layer ? layer.id === selectedLayerId : false}
                offset={shiftFor(i)}
                dragging={drag?.id === id ? drag.dy : null}
                thumb={
                  layer ? (
                    props.renderThumb(layer, ROW_THUMB)
                  ) : (
                    <View style={styles.paintThumb}>
                      <Icon name="paintbrush.pointed" size={20} />
                    </View>
                  )
                }
                onToggleVisible={() => (layer ? toggleLayerVisible(layer.id) : togglePaintVisible())}
                onRemove={() => {
                  tapFeedback();
                  if (layer) props.onRemove(layer.id);
                  else clearPaint();
                  props.onNotice(info.removed);
                }}
                onOpen={() => {
                  selectFeedback();
                  // la fila PINTURA abre el pincel (en Modulación avisa que no se modula); una capa, su inspector
                  if (!layer) return props.startInLayer ? props.onNotice(PAINT_NO_MOD) : props.onOpenBrush();
                  props.onSelect(layer.id);
                  setView("layer");
                }}
                onDragStart={() => {
                  lockSheet(true);
                  tapFeedback();
                  setDrag({ id, from: i, dy: 0 });
                }}
                onDragMove={(dy) => setDrag((d) => (d ? { ...d, dy } : d))}
                onDragEnd={() => {
                  lockSheet(false);
                  const d = dragRef.current;
                  if (d && dropIndex(d) !== d.from) moveLayer(d.id, dropIndex(d));
                  setDrag(null);
                }}
                onMove={(to) => moveLayer(id, to)}
              />
            );
          })}
          <View style={styles.addRow}>{addButton}</View>
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
  rowLifted: { zIndex: 10, shadowColor: colors.ink, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
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
  addRow: { paddingTop: space.sm },
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
  paintThumb: { flex: 1, alignItems: "center", justifyContent: "center" },
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
