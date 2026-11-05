import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { SourceId } from "../../state/types";
import { ChipRow, type Chip } from "../ChipRow";
import { Slider } from "../Slider";
import { colors, type } from "../tokens";

/** Fuentes que se pueden asignar a un eje desde el panel (4.2). `touch` = DEDO (sin ruta). */
const SOURCES: readonly Chip<SourceId>[] = [
  { id: "touch", label: "DEDO" },
  { id: "lfo", label: "LFO" },
  { id: "adsr", label: "ADSR" },
  { id: "sh", label: "S&H" },
  { id: "seq", label: "SEQ" },
  { id: "orientation", label: "GIRO · PRONTO", disabled: true },
  { id: "mic", label: "MIC" },
];

type Props = {
  axis: "x" | "y";
  source: SourceId;
  amount: number;
  onSource: (source: SourceId) => void;
  /** Se confirma al soltar el deslizador (un movimiento completo = un cambio, 3.8). */
  onAmount: (amount: number) => void;
};

/** Modulación de un eje: selector de fuente y cantidad de -1 a 1 (MOD-03). */
export function RouteRow({ axis, source, amount, onSource, onAmount }: Props) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? amount;
  return (
    <View style={styles.root}>
      <Text style={styles.axis}>{axis.toUpperCase()}</Text>
      <View style={styles.body}>
        <ChipRow chips={SOURCES} value={source} onChange={onSource} />
        {source !== "touch" && (
          <Slider
            label={`Cantidad ${shown >= 0 ? "+" : ""}${shown.toFixed(2)}`}
            value={(shown + 1) / 2}
            onChange={(v) => setDraft(Math.round((v * 2 - 1) * 100) / 100)}
            onSlidingEnd={() => {
              if (draft !== null) onAmount(draft);
              setDraft(null);
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  axis: { width: 14, color: colors.inkText, fontFamily: type.family, fontSize: type.label, paddingTop: 4 },
  body: { flex: 1, gap: 2 },
});
