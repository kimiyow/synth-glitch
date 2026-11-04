import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Route, SourceConfig, SourceId } from "../../state/types";
import { ChipRow } from "../ChipRow";
import { colors, space, type } from "../tokens";
import { RouteRow } from "./RouteRow";
import { SourceEditor, type ModSourceId } from "./SourceEditor";

const VIEWS = [
  { id: "routes", label: "RUTAS" },
  { id: "sources", label: "FUENTES" },
] as const;
type View_ = (typeof VIEWS)[number]["id"];

const SOURCES: { id: ModSourceId | "mic"; label: string; disabled?: boolean }[] = [
  { id: "lfo", label: "LFO" },
  { id: "adsr", label: "ADSR" },
  { id: "sh", label: "S&H" },
  { id: "seq", label: "SEQ" },
  { id: "tempo", label: "TEMPO" },
  { id: "mic", label: "MIC · M9", disabled: true },
];

type Props = {
  sources: SourceConfig;
  onSources: (next: SourceConfig) => void;
  onTempo: (bpm: number) => void;
  /** Capa seleccionada en el panel Efectos; sin ella no hay rutas que editar. */
  layer: { id: string; label: string } | null;
  routes: readonly Route[];
  onRouteSource: (layerId: string, axis: "x" | "y", source: SourceId) => void;
  onRouteAmount: (layerId: string, axis: "x" | "y", amount: number) => void;
};

/**
 * Panel MOD: una vista a la vez. RUTAS elige qué fuente mueve cada eje de la capa
 * seleccionada (MOD-03), un eje a la vez; FUENTES ajusta LFO, ADSR, S&H, SEQ y tempo.
 */
export function ModPanel({ sources, onSources, onTempo, layer, routes, onRouteSource, onRouteAmount }: Props) {
  const [view, setView] = useState<View_>("routes");
  const [axis, setAxis] = useState<"x" | "y">("x");
  const [source, setSource] = useState<ModSourceId>("lfo");
  const routeFor = (a: "x" | "y") => routes.find((r) => r.target.layerId === layer?.id && r.target.param === a) ?? null;
  const axisLabel = (a: "x" | "y") => {
    const r = routeFor(a);
    return `${a.toUpperCase()} · ${r ? SOURCE_LABEL[r.source] : "DEDO"}`;
  };
  const route = routeFor(axis);

  return (
    <View style={styles.root}>
      <ChipRow chips={VIEWS} value={view} onChange={setView} />
      {view === "routes" ? (
        layer ? (
          <View style={styles.section}>
            <Text style={styles.readout}>{layer.label}</Text>
            <ChipRow
              chips={[
                { id: "x", label: axisLabel("x") },
                { id: "y", label: axisLabel("y") },
              ]}
              value={axis}
              onChange={setAxis}
            />
            <RouteRow
              key={`${layer.id}-${axis}`}
              axis={axis}
              source={route?.source ?? "touch"}
              amount={route?.amount ?? 0.5}
              onSource={(s) => onRouteSource(layer.id, axis, s)}
              onAmount={(a) => onRouteAmount(layer.id, axis, a)}
            />
          </View>
        ) : (
          <Text style={styles.readout}>SELECCIONA UNA CAPA EN EFECTOS PARA MODULARLA</Text>
        )
      ) : (
        <View style={styles.section}>
          <ChipRow chips={SOURCES} value={source} onChange={(id) => id !== "mic" && setSource(id)} />
          <SourceEditor source={source} sources={sources} onChange={onSources} onTempo={onTempo} />
        </View>
      )}
    </View>
  );
}

const SOURCE_LABEL: Record<SourceId, string> = {
  touch: "DEDO",
  lfo: "LFO",
  adsr: "ADSR",
  sh: "S&H",
  seq: "SEQ",
  orientation: "GIRO",
  mic: "MIC",
  track: "PISTA",
  tempo: "TEMPO",
};

const styles = StyleSheet.create({
  root: { gap: space.md },
  section: { gap: space.sm },
  readout: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
});
