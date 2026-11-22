import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { GesturePreset, Route, SourceConfig } from "../../domain/types";
import { useSettings } from "../../state/appSettings";
import { MAX_GESTURE_PRESETS } from "../../state/settings";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
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
  // guarda el gesto de la capa en la biblioteca; devuelve el nombre o null si está llena
  onSave: () => string | null;
  onRemove: () => void;
  onApply: (preset: GesturePreset) => void;
  onDelete: (id: string) => void;
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

// panel Gesto: qué es, el gesto de la capa seleccionada (en bucle, con su señal en vivo) y la
// biblioteca para llevarlo a otras capas o proyectos
export function GesturePanel({ layer, route, routes, scene, onRecord, onSave, onRemove, onApply, onDelete }: Props) {
  const presets = useSettings((s) => s.gestures);
  const [scopeW, setScopeW] = useState(0);
  // nombre con el que se guardó el gesto actual (se olvida al grabar otro)
  const [savedAs, setSavedAs] = useState<{ routeId: string; samples: number; name: string } | null>(null);
  const clip = route?.settings?.gesture ?? null;
  const saved = savedAs && route && clip && savedAs.routeId === route.id && savedAs.samples === clip.samples.length ? savedAs.name : null;

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Graba un movimiento del dedo de hasta 10 s. Al soltar, la capa lo repite en bucle. Guárdalo en la biblioteca para aplicarlo a otro efecto.
      </Text>

      {!layer ? (
        <View style={styles.card}>
          <Text style={styles.cardNote}>Elige una capa en Efectos o Capas para grabar su gesto.</Text>
        </View>
      ) : route && clip ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.loopBadge} accessible accessibilityLabel={`${layer.label} repite el gesto en bucle`}>
              <Icon name="repeat" size={12} color={colors.paperText} />
              <Text style={styles.loopText} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
                EN BUCLE
              </Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {layer.label} · {(clip.durationMs / 1000).toFixed(1)} s
            </Text>
            <IconButton icon="trash" label="Quitar el gesto de la capa" size={32} bare onPress={onRemove} />
          </View>
          {/* señal en vivo: se ve avanzar y volver a empezar, así se nota que se repite */}
          <View style={styles.scope} onLayout={(e) => setScopeW(e.nativeEvent.layout.width)}>
            {scopeW > 0 && <LiveScope route={route} routes={routes} sources={scene} base={layer.params} width={scopeW} height={SCOPE_H} />}
          </View>
          <Text style={styles.cardNote}>
            Mueve {layer.axes.x} y {layer.axes.y}. Para ajustarlo o mezclarlo con otras fuentes, ábrelo en Modulación.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saved !== null }}
              disabled={saved !== null}
              onPress={() => {
                const name = onSave();
                if (name) setSavedAs({ routeId: route.id, samples: clip.samples.length, name });
              }}
              style={({ pressed }) => [styles.action, styles.actionPrimary, saved !== null && styles.actionDone, pressed && styles.pressed]}
            >
              <Icon name={saved ? "checkmark" : "tray.and.arrow.down"} size={15} color={saved ? colors.inkText : colors.paperText} />
              <Text style={[styles.actionText, !saved && styles.actionTextPrimary]} maxFontSizeMultiplier={COMPACT_FONT_SCALE} numberOfLines={1}>
                {saved ? `Guardado · ${saved}` : "Guardar en biblioteca"}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onRecord} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <View style={styles.recDotSmall} />
              <Text style={styles.actionText} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
                Regrabar
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={onRecord} style={({ pressed }) => [styles.rec, pressed && styles.pressed]}>
          <View style={styles.recDot} />
          <Text style={styles.recText} numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
            Grabar gesto en {layer.label}
          </Text>
        </Pressable>
      )}

      <Text style={styles.section}>
        BIBLIOTECA <Text style={styles.count}>{presets.length}/{MAX_GESTURE_PRESETS}</Text>
      </Text>
      {presets.length === 0 ? (
        <Text style={styles.empty}>Aún no hay gestos guardados. Graba uno y toca «Guardar en biblioteca» para usarlo en otras capas o proyectos.</Text>
      ) : (
        <View style={styles.list}>
          {presets.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={styles.glyph}>
                <SourceGlyph route={asRoute(p)} scene={scene} width={52} height={26} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.dur}>{(p.durationMs / 1000).toFixed(1)} s</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Aplicar ${p.name}${layer ? ` a ${layer.label}` : ""}`}
                disabled={!layer}
                onPress={() => onApply(p)}
                hitSlop={{ top: 7, bottom: 7 }}
                style={({ pressed }) => [styles.apply, !layer && styles.disabled, pressed && styles.pressed]}
              >
                <Icon name="arrow.down.to.line" size={13} />
                <Text style={styles.applyText}>APLICAR</Text>
              </Pressable>
              <IconButton
                icon="trash"
                label={`Borrar ${p.name}`}
                size={32}
                bare
                onPress={() => {
                  void confirmDelete({
                    section: "BIBLIOTECA",
                    title: `¿Borrar «${p.name}»?`,
                    message: "Se borra de la biblioteca de todos los proyectos. No se puede deshacer.",
                    label: "Borrar gesto",
                  }).then((ok) => ok && onDelete(p.id));
                }}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  intro: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, lineHeight: 18 },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.inkSurface },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cardTitle: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.body - 1, fontWeight: "600" },
  cardNote: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, lineHeight: 17 },
  loopBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    minHeight: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
  },
  loopText: { color: colors.paperText, fontFamily: type.family, fontSize: type.micro, fontWeight: "700", letterSpacing: 1 },
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
  section: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2, marginTop: space.xs },
  count: { fontWeight: "400" },
  empty: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, lineHeight: 17 },
  list: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.inkSurface },
  glyph: { width: 60, height: 34, borderRadius: radius.sm, backgroundColor: colors.inkRaised, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  dur: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontVariant: ["tabular-nums"] },
  apply: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 30, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: colors.inkRaised },
  applyText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
});
