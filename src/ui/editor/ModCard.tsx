import type { SFSymbol } from "expo-symbols";
import { useContext, useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { patchModulationSettings, removeModulation, setModulationSource, updateModulation } from "../../actions/sceneEdits";
import type { Route, RouteSettings, SourceConfig, SourceId } from "../../domain/types";
import { selectFeedback } from "../../platform/haptics";
import { Icon } from "../kit/Icon";
import { IconButton } from "../kit/IconButton";
import { IconTiles, type IconTile } from "../kit/IconTiles";
import { Segmented } from "../kit/Segmented";
import { SheetPin } from "../kit/Sheet";
import { useLiveMod } from "../../canvas/modBus";
import { defaultRouteSetting } from "../../modulation/sources";
import { colors, radius, space, type } from "../tokens";
import { LiveScope } from "./LiveScope";
import { SourceGlyph } from "./SourceGlyph";
import { useGestureRecord } from "./gestureRecord";
import { CommitSlider, hasAdvanced, RoutePreview, RouteSourceEditor, type MicView } from "./SourceEditor";

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

// dos grupos de pocas opciones: las que se mueven solas y las que reaccionan a ti
const tilesFor = (ids: SourceId[]): IconTile<SourceId>[] =>
  ids.map((id) => MOD_SOURCES.find((s) => s.id === id)).flatMap((s) => (s ? [{ id: s.id, label: s.label, icon: s.icon, hint: s.what }] : []));
const AUTO_TILES = tilesFor(["lfo", "sh", "seq", "tempo"]);
const REACT_TILES = tilesFor(["adsr", "mic", "track"]);
const inGroup = (tiles: IconTile<SourceId>[], id: SourceId) => (tiles.some((t) => t.id === id) ? id : null);
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
  // recién creada: se abre con los grupos de fuentes a la vista para elegir
  fresh?: boolean;
  onToggle: () => void;
  onNotice: (text: string) => void;
};

const percent = (v: number) => `${Math.round(v * 100)} %`;


// tarjeta de una modulación. Cerrada: una línea (forma, fuente → parámetro, intensidad). Abierta:
// la señal en vivo, la fuente, el parámetro, su ajuste principal y la intensidad; lo demás plegado
export function ModCard({ route: committed, index, routes: committedRoutes, params, base, scene, mic, expanded, fresh = false, onToggle, onNotice }: Props) {
  // valor provisional mientras se arrastra un ajuste: la gráfica lo muestra al instante y la escena
  // cambia al soltar (un solo paso de deshacer). Se descarta en cuanto la ruta confirmada cambia
  const [draft, setDraft] = useState<{ from: Route; value: Route } | null>(null);
  const route = draft && draft.from === committed ? draft.value : committed;
  const routes = route === committed ? committedRoutes : committedRoutes.map((r) => (r.id === route.id ? route : r));
  const previewing = useRef(false);
  const preview = (commit: () => void) => {
    previewing.current = true;
    try {
      commit();
    } finally {
      previewing.current = false;
    }
  };
  const live = useLiveMod();
  const edit = (label: string, recipe: (r: Route) => void) => {
    if (!previewing.current) return updateModulation(committed.id, label, recipe);
    const next = JSON.parse(JSON.stringify(route)) as Route;
    recipe(next);
    setDraft({ from: committed, value: next });
    // el efecto en la imagen sigue el valor provisional en el acto (hilo de UI, sin re-render)
    live?.bus.draftRoutes.set(committedRoutes.map((r) => (r.id === next.id ? next : r)));
  };
  // una tarjeta que se cierra a mitad de un arrastre no deja el efecto con valores provisionales
  const draftRoutes = live?.bus.draftRoutes;
  useEffect(() => () => draftRoutes?.set(null), [draftRoutes]);
  const [scopeW, setScopeW] = useState(0);
  const [more, setMore] = useState(false);
  // elegir fuente es poco frecuente; ajustarla es lo común: los grupos se ven solo al pedirlos
  const [picking, setPicking] = useState(fresh);
  const rec = useGestureRecord();
  const pickSource = (s: SourceId) => {
    if (s === "track" && route.source !== "track") {
      // una sola modulación GESTO por capa (el panel Gesto trabaja con ella). Elegir GESTO deja la
      // tarjeta con sus opciones; el panel Gesto se abre desde «Ver gestos grabados»
      const other = routes.some((r) => r.id !== route.id && r.target.layerId === route.target.layerId && r.source === "track");
      if (other) {
        rec?.notice("ESTA CAPA YA TIENE UN GESTO EN OTRA MODULACIÓN");
        setPicking(false);
        return;
      }
    }
    setModulationSource(route.id, s);
    setPicking(false);
  };
  const sheet = useContext(SheetPin);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const src = MOD_SOURCES.find((s) => s.id === route.source) ?? MOD_SOURCES[0];
  // el gesto mueve los dos parámetros (horizontal → el primero, vertical → el segundo)
  const isGesture = route.source === "track";
  const paramName = isGesture ? `${params.x} + ${params.y}` : params[route.target.param];
  // la línea gris muestra el parámetro de la ruta (en el gesto y el giro, el primero de los dos)
  const resultName = params[route.target.param];
  const patch = <K extends keyof RouteSettings>(key: K, label: string, p: Partial<NonNullable<RouteSettings[K]>>) => {
    if (!previewing.current) return patchModulationSettings(committed.id, key, label, p);
    // igual que patchModulationSettings, sobre la copia provisional
    edit(label, (r) => {
      if (!r.settings?.[key]) r.settings = { ...r.settings, ...defaultRouteSetting(key as SourceId, scene) };
      const cur = r.settings[key];
      if (cur) Object.assign(cur, p);
    });
  };

  // abierta dentro de una hoja: la tarjeta se lleva a la vista. La gráfica en vivo va dentro de la
  // tarjeta (no fijada en la hoja): sale siempre que la tarjeta esté abierta, se llegue desde
  // Modulación, Capas o Efectos
  useEffect(() => {
    if (!expanded || !sheet) return;
    const id = setTimeout(() => sheet.scrollIntoView(cardRef), 60);
    return () => clearTimeout(id);
  }, [expanded, sheet]);

  return (
    <View ref={cardRef} collapsable={false} style={[styles.card, expanded && styles.cardOpen]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Modulación ${index + 1}: ${src.label} mueve ${paramName}, intensidad ${percent(route.amount)}`}
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
        <Text style={styles.amount}>{percent(route.amount)}</Text>
        <Icon name={expanded ? "chevron.up" : "chevron.down"} size={12} color={colors.inkMute} />
        {/* salida rápida: quitarla sin preguntar (se deshace con ↶) */}
        <IconButton
          icon="trash"
          label={`Quitar ${SOURCE_LABEL[route.source]} → ${paramName}`}
          size={32}
          bare
          onPress={() => {
            removeModulation(route.id);
            onNotice("MODULACIÓN QUITADA · ↶ PARA DESHACER");
          }}
        />
      </Pressable>

      {expanded && (
        <RoutePreview.Provider value={preview}>
        <View style={styles.body}>
          {/* blanco: la señal de la fuente · gris: cómo queda el parámetro */}
          <View style={styles.scope} onLayout={(e) => setScopeW(Math.round(e.nativeEvent.layout.width))}>
            {scopeW > 0 && <LiveScope route={route} routes={routes} sources={scene} base={base} width={scopeW} height={SCOPE_H} />}
          </View>
          <Text style={styles.caption}>Así se mueve {resultName}</Text>

          {picking ? (
            <>
              <View style={styles.group}>
                <Text style={styles.groupLabel}>SE MUEVE SOLA</Text>
                <IconTiles tiles={AUTO_TILES} value={inGroup(AUTO_TILES, route.source)} onChange={pickSource} />
              </View>
              <View style={styles.group}>
                <Text style={styles.groupLabel}>REACCIONA A TI</Text>
                <IconTiles tiles={REACT_TILES} value={inGroup(REACT_TILES, route.source)} onChange={pickSource} />
              </View>
              <Text style={styles.what}>{src.what}</Text>
            </>
          ) : (
            // fuente elegida en una fila: su ficha, qué hace y CAMBIAR
            <View style={styles.chosen}>
              <View style={styles.chosenTile}>
                <Icon name={src.icon} size={16} color={colors.paperText} />
              </View>
              <View style={styles.chosenText}>
                <Text style={styles.chosenLabel}>{src.label}</Text>
                <Text style={styles.chosenWhat} numberOfLines={1}>
                  {src.what}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cambiar la fuente, ahora ${src.label}`}
                hitSlop={8}
                onPress={() => {
                  selectFeedback();
                  setPicking(true);
                }}
                style={({ pressed }) => [styles.change, pressed && styles.pressed]}
              >
                <Text style={styles.changeText}>CAMBIAR</Text>
              </Pressable>
            </View>
          )}

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
            label={route.amount < 0 ? "Intensidad · al revés" : "Intensidad"}
            format={percent}
            toValue={(u) => Math.round((u * 2 - 1) * 100) / 100}
            fromValue={(v) => (v + 1) / 2}
            centered
            marks={{ left: "−100", mid: "0", right: "+100" }}
            value={route.amount}
            onCommit={(amount) => edit("intensidad", (r) => void (r.amount = amount))}
          />
          <Text style={styles.hint}>Cuánto se mueve. A la izquierda del centro, al revés.</Text>

          {more && (
            <View style={styles.more}>
              {hasAdvanced(route) && <RouteSourceEditor route={route} scene={scene} mic={mic} patch={patch} advanced />}
              <Segmented
                options={[
                  { id: "add", label: "SUMA A TU VALOR" },
                  { id: "replace", label: "TOMA EL CONTROL" },
                ]}
                value={route.mode}
                onChange={(mode) => updateModulation(route.id, "modo de modulación", (r) => void (r.mode = mode))}
              />
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
              <Text style={styles.footText}>{more ? "OCULTAR OPCIONES AVANZADAS" : "OPCIONES AVANZADAS"}</Text>
            </Pressable>
          </View>
        </View>
        </RoutePreview.Provider>
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
  caption: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, textAlign: "center", marginTop: -space.sm },
  hint: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, lineHeight: 17, marginTop: -space.sm },
  group: { gap: 6 },
  chosen: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chosenTile: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  chosenText: { flex: 1, gap: 2 },
  chosenLabel: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "700", letterSpacing: 0.8 },
  chosenWhat: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.4 },
  change: { minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.inkRaised, justifyContent: "center" },
  changeText: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  groupLabel: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2 },
  what: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, marginTop: -space.xs },
  axes: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.8, textAlign: "center" },
  more: { gap: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 },
  footText: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
});
