import { Pressable, StyleSheet, Text, View } from "react-native";

import type { GesturePreset, Route, SourceConfig } from "../../domain/types";
import { useSettings } from "../../state/appSettings";
import { MAX_GESTURE_PRESETS } from "../../state/settings";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
import { colors, radius, space, type } from "../tokens";
import { SourceGlyph } from "./SourceGlyph";

type Props = {
  // capa seleccionada (nombre a mostrar) o null
  layerLabel: string | null;
  scene: SourceConfig;
  onRecord: () => void;
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

// panel Gesto: atajo para grabar sobre la capa seleccionada y biblioteca de gestos guardados
export function GesturePanel({ layerLabel, scene, onRecord, onApply, onDelete }: Props) {
  const presets = useSettings((s) => s.gestures);
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !layerLabel }}
        disabled={!layerLabel}
        onPress={onRecord}
        style={({ pressed }) => [styles.rec, !layerLabel && styles.disabled, pressed && styles.pressed]}
      >
        <View style={styles.recDot} />
        <Text style={styles.recText} numberOfLines={1}>
          {layerLabel ? `GRABAR EN ${layerLabel}` : "ELIGE UNA CAPA EN EFECTOS"}
        </Text>
      </Pressable>

      <Text style={styles.section}>
        BIBLIOTECA <Text style={styles.count}>{presets.length}/{MAX_GESTURE_PRESETS}</Text>
      </Text>
      {presets.length === 0 ? (
        <Text style={styles.empty}>Sin gestos guardados</Text>
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
                accessibilityLabel={`Aplicar ${p.name}${layerLabel ? ` a ${layerLabel}` : ""}`}
                disabled={!layerLabel}
                onPress={() => onApply(p)}
                style={({ pressed }) => [styles.apply, !layerLabel && styles.disabled, pressed && styles.pressed]}
              >
                <Icon name="arrow.down.to.line" size={13} />
                <Text style={styles.applyText}>APLICAR</Text>
              </Pressable>
              <IconButton icon="trash" label={`Borrar ${p.name}`} size={32} bare onPress={() => onDelete(p.id)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
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
  recText: { color: colors.paperText, fontFamily: type.family, fontSize: type.label, fontWeight: "700", letterSpacing: 1.2 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  section: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2 },
  count: { fontWeight: "400" },
  empty: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label },
  list: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.inkSurface },
  glyph: { width: 60, height: 34, borderRadius: radius.sm, backgroundColor: colors.inkRaised, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  dur: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontVariant: ["tabular-nums"] },
  apply: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 30, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: colors.inkRaised },
  applyText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
});
