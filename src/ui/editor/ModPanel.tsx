import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { SourceConfig } from "../../state/types";
import { ChipRow } from "../ChipRow";
import { space } from "../tokens";
import { SourceEditor, type ModSourceId } from "./SourceEditor";

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
};

/**
 * Panel MOD (sección propia de la barra): ajustes de las fuentes de modulación y tempo.
 * Qué fuente mueve cada eje se elige en el panel Efectos.
 */
export function ModPanel({ sources, onSources, onTempo }: Props) {
  const [source, setSource] = useState<ModSourceId>("lfo");
  return (
    <View style={styles.root}>
      <ChipRow chips={SOURCES} value={source} onChange={(id) => id !== "mic" && setSource(id)} />
      <SourceEditor source={source} sources={sources} onChange={onSources} onTempo={onTempo} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
});
