import type { SFSymbol } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { patchModulationSettings, removeModulation, setModulationSource, updateModulation } from "../../actions/sceneEdits";
import type { Route, RouteCurve, RouteSettings, SourceConfig, SourceId } from "../../domain/types";
import { selectFeedback } from "../../platform/haptics";
import { ChipRow, type Chip } from "../ChipRow";
import { Icon } from "../kit/Icon";
import { IconTiles, type IconTile } from "../kit/IconTiles";
import { Segmented } from "../kit/Segmented";
import { colors, radius, space, type } from "../tokens";
import { LiveScope } from "./LiveScope";
import { SourceGlyph } from "./SourceGlyph";
import { CommitSlider, hasAdvanced, RouteSourceEditor, type MicView } from "./SourceEditor";

// fuentes que se pueden asignar: nombre corto, icono y qué hacen (para lectores de pantalla)
export const MOD_SOURCES: { id: SourceId; label: string; icon: SFSymbol; what: string }[] = [
  { id: "lfo", label: "LFO", icon: "waveform", what: "Oscila sola, como una onda" },
  { id: "adsr", label: "ADSR", icon: "chart.line.uptrend.xyaxis", what: "Sube y baja cada vez que la disparas" },
  { id: "sh", label: "AZAR", icon: "dice", what: "Salta a un valor al azar en cada pulso" },
  { id: "seq", label: "PASOS", icon: "chart.bar.fill", what: "Recorre una secuencia que tú dibujas" },
  { id: "tempo", label: "PULSO", icon: "metronome", what: "Una rampa en cada tiempo del reloj" },
  { id: "mic", label: "MIC", icon: "mic", what: "Responde al sonido del micrófono" },
  { id: "track", label: "GESTO", icon: "hand.draw", what: "Repite en bucle un movimiento que grabas con el dedo" },
];
export const SOURCE_LABEL = Object.fromEntries(MOD_SOURCES.map((s) => [s.id, s.label])) as Record<SourceId, string>;
export const SOURCE_ICON = Object.fromEntries(MOD_SOURCES.map((s) => [s.id, s.icon])) as Record<SourceId, SFSymbol>;

const SOURCE_TILES: readonly IconTile<SourceId>[] = MOD_SOURCES.map((s) => ({ id: s.id, label: s.label, icon: s.icon, hint: s.what }));
const CURVES: readonly Chip<RouteCurve>[] = [
  { id: "lin", label: "LINEAL" },
  { id: "scurve", label: "SUAVE" },
  { id: "exp", label: "LENTA" },
  { id: "log", label: "RÁPIDA" },
];
const SCOPE_H = 76;

type Props = {
  route: Route;
  index: number;
  // todas las rutas de la escena (la vista en vivo muestra el resultado de todas sobre el parámetro)
  routes: readonly Route[];
  // nombres reales de los dos parámetros de la capa (p. ej. Desplazamiento, Ángulo)
  params: { x: string; y: string };
  // valores de los parámetros de la capa sin modular
  base: { x: number; y: number };
  scene: SourceConfig;
  mic: MicView;
  expanded: boolean;
  onToggle: () => void;
};

const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

// tarjeta de una modulación. Cerrada: una línea (forma, fuente → parámetro, intensidad). Abierta:
// la señal en vivo, la fuente, el parámetro, su ajuste principal y la intensidad; lo demás plegado
export function ModCard({ route, index, routes, params, base, scene, mic, expanded, onToggle }: Props) {
  const [scopeW, setScopeW] = useState(0);
  const [more, setMore] = useState(false);
  const src = MOD_SOURCES.find((s) => s.id === route.source) ?? MOD_SOURCES[0];
  // el gesto mueve los dos parámetros (horizontal → el primero, vertical → el segundo)
  const isGesture = route.source === "track";
  const paramName = isGesture ? `${params.x} + ${params.y}` : params[route.target.param];
  const patch = <K extends keyof RouteSettings>(key: K, label: string, p: Partial<NonNullable<RouteSettings[K]>>) =>
    patchModulationSettings(route.id, key, label, p);

  return (
    <View style={[styles.card, expanded && styles.cardOpen]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Modulación ${index + 1}: ${src.label} mueve ${paramName}, intensidad ${signed(route.amount)}`}
        onPress={() => {
          selectFeedback();
          onToggle();
        }}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={styles.glyph}>
          <SourceGlyph route={route} scene={scene} width={44} height={22} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {src.label} <Text style={styles.mute}>→</Text> {paramName}
        </Text>
        <Text style={styles.amount}>{signed(route.amount)}</Text>
        <Icon name={expanded ? "chevron.up" : "chevron.down"} size={12} color={colors.inkMute} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {/* blanco: la señal de la fuente · gris: cómo queda el parámetro */}
          <View style={styles.scope} onLayout={(e) => setScopeW(Math.round(e.nativeEvent.layout.width))}>
            {scopeW > 0 && <LiveScope route={route} routes={routes} sources={scene} base={base} width={scopeW} height={SCOPE_H} />}
            <View style={styles.legend} pointerEvents="none">
              <View style={[styles.swatch, styles.swatchSignal]} />
              <Text style={styles.legendText}>{src.label}</Text>
              <View style={[styles.swatch, styles.swatchResult]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {paramName}
              </Text>
            </View>
          </View>

          <IconTiles tiles={SOURCE_TILES} value={route.source} onChange={(s) => setModulationSource(route.id, s)} />

          {isGesture ? (
            <Text style={styles.axes} numberOfLines={1}>
              ↔ {params.x} · ↕ {params.y}
            </Text>
          ) : (
            <Segmented
              options={[
                { id: "x", label: params.x.toUpperCase() },
                { id: "y", label: params.y.toUpperCase() },
              ]}
              value={route.target.param}
              onChange={(param) => updateModulation(route.id, "parámetro modulado", (r) => void (r.target.param = param))}
            />
          )}

          <RouteSourceEditor route={route} scene={scene} mic={mic} patch={patch} />

          <CommitSlider
            label={route.amount < 0 ? "Intensidad · invertida" : "Intensidad"}
            format={signed}
            toValue={(u) => Math.round((u * 2 - 1) * 100) / 100}
            fromValue={(v) => (v + 1) / 2}
            value={route.amount}
            onCommit={(amount) => updateModulation(route.id, "intensidad", (r) => void (r.amount = amount))}
          />

          {more && (
            <View style={styles.more}>
              {hasAdvanced(route) && <RouteSourceEditor route={route} scene={scene} mic={mic} patch={patch} advanced />}
              <Segmented
                options={[
                  { id: "add", label: "SUMA AL GESTO" },
                  { id: "replace", label: "REEMPLAZA" },
                ]}
                value={route.mode}
                onChange={(mode) => updateModulation(route.id, "modo de modulación", (r) => void (r.mode = mode))}
              />
              <ChipRow chips={CURVES} value={route.curve} onChange={(curve) => updateModulation(route.id, "curva", (r) => void (r.curve = curve))} />
            </View>
          )}

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: more }}
              hitSlop={8}
              onPress={() => setMore((m) => !m)}
              style={({ pressed }) => [styles.footBtn, pressed && styles.pressed]}
            >
              <Icon name="slider.horizontal.3" size={13} color={colors.inkMute} />
              <Text style={styles.footText}>{more ? "MENOS" : "MÁS"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quitar modulación"
              hitSlop={8}
              onPress={() => removeModulation(route.id)}
              style={({ pressed }) => [styles.footBtn, pressed && styles.pressed]}
            >
              <Icon name="trash" size={13} color={colors.inkMute} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: colors.inkSurface, overflow: "hidden" },
  cardOpen: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.inkLineStrong },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, paddingRight: space.md, minHeight: 48 },
  pressed: { opacity: 0.6 },
  glyph: { width: 52, height: 32, borderRadius: radius.sm, backgroundColor: colors.inkRaised, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600", letterSpacing: 0.6 },
  mute: { color: colors.inkMute, fontWeight: "400" },
  amount: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, fontVariant: ["tabular-nums"] },
  body: { gap: space.md, paddingHorizontal: space.md, paddingBottom: space.xs },
  scope: { height: SCOPE_H, borderRadius: radius.sm, backgroundColor: colors.ink, overflow: "hidden" },
  legend: { position: "absolute", top: 6, left: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  swatch: { width: 8, height: 2, borderRadius: 1 },
  swatchSignal: { backgroundColor: colors.inkText },
  swatchResult: { backgroundColor: colors.inkMute, marginLeft: 6 },
  legendText: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.6 },
  axes: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.8, textAlign: "center" },
  more: { gap: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 },
  footText: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
});
