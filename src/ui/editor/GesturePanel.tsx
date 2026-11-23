import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { findSameGesture, MAX_GESTURE_NAME } from "../../actions/gestureLibrary";
import type { GestureTransform } from "../../actions/sceneEdits";
import type { GestureClip, GestureDirection, GesturePreset, Route, SourceConfig } from "../../domain/types";
import { gestureSpeed, GESTURE_SPEEDS } from "../../modulation/sources";
import { useSettings } from "../../state/appSettings";
import { MAX_GESTURE_PRESETS } from "../../state/settings";
import { Segmented } from "../kit/Segmented";
import { useRevealOnFocus } from "../kit/Sheet";
import { confirmDelete } from "../../state/confirm";
import { colors, COMPACT_FONT_SCALE, radius, space, type } from "../tokens";
import { LiveScope } from "./LiveScope";
import { SourceGlyph } from "./SourceGlyph";

type Props = {
  // capa seleccionada (nombre y ejes) o null
  layer: { label: string; axes: { x: string; y: string }; params: { x: number; y: number } } | null;
  // modulación GESTO con un gesto grabado en la capa seleccionada
  route: Route | null;
  routes: readonly Route[];
  scene: SourceConfig;
  onRecord: () => void;
  // guarda el gesto de la capa en la biblioteca (no lo duplica si ya está)
  onSave: () => void;
  onRemove: () => void;
  // velocidad, dirección y espejo del gesto de la capa
  onTransform: (patch: GestureTransform) => void;
  trailVisible: boolean;
  onToggleTrail: () => void;
  onApply: (preset: GesturePreset) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  // gesto guardado en vista previa, para dibujarlo sobre la imagen (null al cerrar la vista previa)
  onPreview?: (clip: GestureClip | null) => void;
};

// glifo del recorrido de un gesto guardado (se dibuja como una modulación GESTO)
const asRoute = (p: GesturePreset): Route => ({
  id: p.id,
  source: "track",
  sourceIndex: 0,
  target: { layerId: "", param: "x" },
  amount: 1,
  curve: "lin",
  mode: "replace",
  settings: { gesture: { durationMs: p.durationMs, samples: p.samples, loop: "cut" } },
});

const SCOPE_H = 56;

// panel Gesto en pasos: sin gesto, qué hacer y Grabar (con la biblioteca debajo); con gesto, su
// señal, Regrabar / Guardar, lo avanzado plegado y la biblioteca. Sin iconos decorativos
const SPEED_LABEL: Record<number, string> = { 0.25: "0.25×", 0.5: "0.5×", 1: "1×", 2: "2×", 4: "4×" };
const DIRECTIONS: { id: GestureDirection; label: string }[] = [
  { id: "forward", label: "Adelante" },
  { id: "reverse", label: "Reversa" },
  { id: "pingpong", label: "Ida y vuelta" },
];

export function GesturePanel(props: Props) {
  const { layer, route, routes, scene, onRecord, onSave, onRemove, onApply, onDelete } = props;
  const presets = useSettings((s) => s.gestures);
  // gesto de la biblioteca cuyo nombre se está editando
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const { ref: revealRef, onFocus: revealOnFocus } = useRevealOnFocus();
  const finishRename = () => {
    if (editing) props.onRename(editing.id, editing.text);
    setEditing(null);
  };
  const [scopeW, setScopeW] = useState(0);
  const clip = route?.settings?.gesture ?? null;
  // el gesto de la capa ya está en la biblioteca (recién guardado o aplicado desde ella): no se
  // ofrece guardarlo otra vez. Muestra el nombre actual, también si se renombró
  const saved = clip ? (findSameGesture(presets, clip)?.name ?? null) : null;

  const [advanced, setAdvanced] = useState(false);
  // gesto de la biblioteca en vista previa
  const [previewId, setPreviewId] = useState<string | null>(null);

  // biblioteca: «usa uno guardado» (sin gesto) o «gestos guardados» (con gesto). Tocar un gesto
  // abre su vista previa (el recorrido y un punto que lo sigue en bucle); desde ahí se usa, se
  // renombra o se borra
  const previewed = presets.find((p) => p.id === previewId) ?? null;
  const { onPreview } = props;
  useEffect(() => {
    onPreview?.(previewed ? { durationMs: previewed.durationMs, samples: previewed.samples, loop: "smooth" } : null);
  }, [previewed, onPreview]);
  // al cerrar el panel, la imagen queda limpia
  useEffect(() => () => onPreview?.(null), [onPreview]);
  const library = (
    <View style={styles.block}>
      <Text style={styles.section}>
        {clip ? "Gestos guardados" : "O usa uno guardado"} <Text style={styles.count}>{presets.length}/{MAX_GESTURE_PRESETS}</Text>
      </Text>
      {presets.length === 0 ? (
        <Text style={styles.note}>Aún no hay gestos guardados. Graba uno y toca Guardar para usarlo en otras capas o proyectos.</Text>
      ) : previewed ? (
        <View style={styles.preview}>
          <View ref={editing ? revealRef : undefined} collapsable={false}>
            {editing ? (
              <TextInput
                value={editing.text}
                onChangeText={(text) => setEditing({ id: previewed.id, text })}
                onEndEditing={finishRename}
                onSubmitEditing={finishRename}
                onFocus={revealOnFocus}
                autoFocus
                selectTextOnFocus
                maxLength={MAX_GESTURE_NAME}
                returnKeyType="done"
                accessibilityLabel={`Nombre de ${previewed.name}`}
                style={[styles.title, styles.nameInput]}
              />
            ) : (
              <Text style={styles.title}>
                {previewed.name} <Text style={styles.titleMute}>· {(previewed.durationMs / 1000).toFixed(1)} s</Text>
              </Text>
            )}
          </View>
          <Text style={styles.note}>Míralo sobre la imagen: el punto blanco es el dedo.</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => setPreviewId(null)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Text style={styles.actionText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Usar ${previewed.name}${layer ? ` en ${layer.label}` : ""}`}
              disabled={!layer}
              onPress={() => {
                setPreviewId(null);
                onApply(previewed);
              }}
              style={({ pressed }) => [styles.action, styles.actionPrimary, !layer && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={[styles.actionText, styles.actionTextPrimary]}>Usar este gesto</Text>
            </Pressable>
          </View>
          <View style={styles.linkRow}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setEditing({ id: previewed.id, text: previewed.name })}>
              <Text style={styles.link}>Cambiar nombre</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                void confirmDelete({
                  section: "BIBLIOTECA",
                  title: `¿Borrar «${previewed.name}»?`,
                  message: "Se borra de la biblioteca de todos los proyectos. No se puede deshacer.",
                  label: "Borrar gesto",
                }).then((ok) => {
                  if (!ok) return;
                  setPreviewId(null);
                  onDelete(previewed.id);
                });
              }}
            >
              <Text style={styles.removeText}>Borrar de la biblioteca</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {presets.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${(p.durationMs / 1000).toFixed(1)} segundos`}
              accessibilityHint="Muestra cómo se mueve antes de usarlo"
              onPress={() => setPreviewId(p.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.glyph}>
                <SourceGlyph route={asRoute(p)} scene={scene} width={52} height={26} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.dur}>{(p.durationMs / 1000).toFixed(1)} s</Text>
              </View>
              <Text style={styles.rowAction}>Ver</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  // vista previa de un gesto guardado: solo ese bloque, así la hoja se encoge y deja ver la imagen
  if (previewed) {
    return <View style={styles.root}>{library}</View>;
  }

  if (!layer) {
    return (
      <View style={styles.root}>
        <Text style={styles.note}>Elige una capa en Efectos o Capas para grabar su gesto.</Text>
      </View>
    );
  }

  // sin gesto: qué hacer y cómo, el botón para grabar y la biblioteca debajo
  if (!route || !clip) {
    return (
      <View style={styles.root}>
        <View style={styles.block}>
          <Text style={styles.title}>Graba un movimiento para {layer.label}</Text>
          <Text style={styles.note}>
            Mueve el dedo sobre la imagen hasta 10 s. Al soltar, {layer.label} repite ese movimiento en bucle: lo horizontal mueve {layer.axes.x} y lo
            vertical, {layer.axes.y}.
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onRecord} style={({ pressed }) => [styles.rec, pressed && styles.pressed]}>
          <View style={styles.recDot} />
          <Text style={styles.recText} numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
            Grabar gesto
          </Text>
        </Pressable>
        {library}
      </View>
    );
  }

  // con gesto: el gesto y su señal, regrabar o guardar, lo avanzado plegado y la biblioteca
  return (
    <View style={styles.root}>
      <View style={styles.block}>
        <Text style={styles.title}>
          Tu gesto <Text style={styles.titleMute}>· {(clip.durationMs / 1000).toFixed(1)} s en bucle</Text>
        </Text>
        {/* señal en vivo: se ve avanzar y volver a empezar, así se nota que se repite */}
        <View style={styles.scope} onLayout={(e) => setScopeW(e.nativeEvent.layout.width)}>
          {scopeW > 0 && <LiveScope route={route} routes={routes} sources={scene} base={layer.params} width={scopeW} height={SCOPE_H} />}
        </View>
        <Text style={styles.note}>{describeGesture(clip, layer.axes)}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onRecord} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <View style={styles.recDotSmall} />
          <Text style={styles.actionText} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
            Regrabar
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saved !== null }}
          disabled={saved !== null}
          onPress={onSave}
          style={({ pressed }) => [styles.action, styles.actionPrimary, saved !== null && styles.actionDone, pressed && styles.pressed]}
        >
          <Text style={[styles.actionText, !saved && styles.actionTextPrimary]} maxFontSizeMultiplier={COMPACT_FONT_SCALE} numberOfLines={1}>
            {saved ? `Guardado como ${saved}` : "Guardar"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Ver el recorrido en la imagen</Text>
        <Switch value={props.trailVisible} onValueChange={props.onToggleTrail} accessibilityLabel="Ver el recorrido en la imagen" />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: advanced }}
        hitSlop={8}
        onPress={() => setAdvanced((v) => !v)}
        style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
      >
        <Text style={styles.moreText}>{advanced ? "Ocultar opciones avanzadas" : "Opciones avanzadas"}</Text>
      </Pressable>
      {advanced && (
        <View style={styles.block}>
          <Text style={styles.label}>Velocidad</Text>
          <Segmented
            options={GESTURE_SPEEDS.map((v) => ({ id: v, label: SPEED_LABEL[v] }))}
            value={gestureSpeed(clip)}
            onChange={(speed) => props.onTransform({ speed })}
          />
          <Text style={styles.label}>Dirección</Text>
          <Segmented options={DIRECTIONS} value={clip.direction ?? "forward"} onChange={(direction) => props.onTransform({ direction })} />
          <Text style={styles.label}>Al volver a empezar</Text>
          <Segmented
            options={[
              { id: "smooth", label: "Se funde" },
              { id: "cut", label: "Salta" },
            ]}
            value={clip.loop}
            onChange={(loop) => props.onTransform({ loop })}
          />
          <Text style={styles.label}>Espejo</Text>
          <View style={styles.mirrors}>
            <MirrorToggle label={`Invertir ${layer.axes.x}`} on={clip.mirrorX === true} onPress={() => props.onTransform({ mirrorX: !clip.mirrorX })} />
            <MirrorToggle label={`Invertir ${layer.axes.y}`} on={clip.mirrorY === true} onPress={() => props.onTransform({ mirrorY: !clip.mirrorY })} />
          </View>
        </View>
      )}

      {library}

      <Pressable accessibilityRole="button" hitSlop={8} onPress={onRemove} style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}>
        <Text style={styles.removeText}>Quitar gesto de {layer.label}</Text>
      </Pressable>
    </View>
  );
}

// el gesto en palabras, bajo su gráfica: entre qué valores lleva cada parámetro (con el espejo
// aplicado) y, si no es la normal, su velocidad y dirección
function describeGesture(clip: GestureClip, axes: { x: string; y: string }): string {
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
  for (let i = 0; i + 1 < clip.samples.length; i += 2) {
    const x = clip.mirrorX ? 1 - clip.samples[i] : clip.samples[i];
    const y = clip.mirrorY ? 1 - clip.samples[i + 1] : clip.samples[i + 1];
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const span = (lo: number, hi: number) => (hi - lo < 0.02 ? `queda en ${pct(lo)}` : `va de ${pct(lo)} a ${pct(hi)}`);
  const speed = gestureSpeed(clip);
  const extra = [speed !== 1 ? `a ${SPEED_LABEL[speed] ?? `${speed}×`}` : null, clip.direction === "reverse" ? "en reversa" : clip.direction === "pingpong" ? "de ida y vuelta" : null]
    .filter(Boolean)
    .join(", ");
  return `${axes.x} ${span(x0, x1)} y ${axes.y} ${span(y0, y1)}${extra ? `, ${extra}` : ""}.`;
}

function MirrorToggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.mirror, on && styles.mirrorOn, pressed && styles.pressed]}
    >
      <Text style={[styles.mirrorText, on && styles.mirrorTextOn]} numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, marginTop: space.xs },
  mirrors: { flexDirection: "row", gap: space.sm },
  mirror: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
  },
  mirrorOn: { backgroundColor: colors.paper },
  mirrorText: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  mirrorTextOn: { color: colors.paperText },
  root: { gap: space.lg },
  block: { gap: space.sm },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600" },
  titleMute: { color: colors.inkMute, fontWeight: "400" },
  note: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, lineHeight: 18 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, minHeight: 44 },
  switchLabel: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label + 1 },
  moreBtn: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
  moreText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label + 1, fontWeight: "600", textDecorationLine: "underline" },
  removeText: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, textDecorationLine: "underline" },
  scope: { height: SCOPE_H, borderRadius: radius.sm, backgroundColor: colors.inkRaised, overflow: "hidden" },
  actions: { flexDirection: "row", gap: space.sm },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
  },
  actionPrimary: { flex: 1, backgroundColor: colors.paper },
  actionDone: { backgroundColor: colors.inkRaised },
  actionText: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label + 1, fontWeight: "600" },
  actionTextPrimary: { color: colors.paperText },
  rec: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.paperText },
  recDotSmall: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.inkText },
  recText: { color: colors.paperText, fontFamily: type.family, fontSize: type.body - 1, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  section: { color: colors.inkText, fontFamily: type.family, fontSize: type.label + 1, fontWeight: "600" },
  count: { color: colors.inkMute, fontWeight: "400" },
  list: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.inkSurface },
  glyph: { width: 60, height: 34, borderRadius: radius.sm, backgroundColor: colors.inkRaised, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  name: { flexShrink: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", maxWidth: "100%" },
  nameInput: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginLeft: -6,
    borderRadius: radius.sm,
    backgroundColor: colors.inkRaised,
  },
  dur: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontVariant: ["tabular-nums"] },
  preview: { gap: space.sm },
  linkRow: { flexDirection: "row", justifyContent: "space-between", minHeight: 32, alignItems: "center" },
  link: { color: colors.inkText, fontFamily: type.family, fontSize: type.label + 1, textDecorationLine: "underline" },
  rowAction: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, paddingRight: space.xs },
  apply: { alignItems: "center", justifyContent: "center", minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.paper },
  applyText: { color: colors.paperText, fontFamily: type.family, fontSize: type.label + 1, fontWeight: "600" },
});
