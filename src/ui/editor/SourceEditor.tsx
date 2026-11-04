import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

import { DIVISIONS, LFO_SHAPES, MAX_BPM, MIN_BPM, SEQ_DIRECTIONS } from "../../modulation/sources";
import { tapTempo } from "../../modulation/tempo";
import type { SourceConfig } from "../../state/types";
import { ChipRow } from "../ChipRow";
import { Slider } from "../Slider";
import { colors, type } from "../tokens";

export type ModSourceId = "lfo" | "adsr" | "sh" | "seq" | "tempo";

type Props = {
  source: ModSourceId;
  sources: SourceConfig;
  /** Cambio confirmado de una fuente (deshacible). */
  onChange: (next: SourceConfig) => void;
  /** Tempo: no entra al historial (3.8). */
  onTempo: (bpm: number) => void;
};

const DIVISION_CHIPS = DIVISIONS.map((d) => ({ id: d, label: d < 1 ? `1/${1 / d}` : `${d}` }));
const SHAPE_LABEL = { sine: "SENO", triangle: "TRIÁNGULO", square: "CUADRADA", saw: "SIERRA", random: "ALEATORIA" };
const DIR_LABEL = { forward: "ADELANTE", backward: "ATRÁS", pingpong: "IDA Y VUELTA", random: "ALEATORIO" };

/** Ajustes de una fuente de modulación (categoría MOD del panel Efectos). */
export function SourceEditor({ source, sources, onChange, onTempo }: Props) {
  const set = <K extends keyof SourceConfig>(key: K, patch: Partial<SourceConfig[K]>) =>
    onChange({ ...sources, [key]: { ...sources[key], ...patch } });

  if (source === "tempo") return <TempoEditor bpm={sources.tempo.bpm} onTempo={onTempo} />;

  if (source === "lfo") {
    const lfo = sources.lfo;
    return (
      <View style={styles.root}>
        <ChipRow chips={LFO_SHAPES.map((s) => ({ id: s, label: SHAPE_LABEL[s] }))} value={lfo.shape} onChange={(shape) => set("lfo", { shape })} />
        <ChipRow
          chips={[{ id: "free", label: "HZ" }, { id: "sync", label: "SINCRONIZADO" }]}
          value={lfo.sync ? "sync" : "free"}
          onChange={(m) => set("lfo", { sync: m === "sync" })}
        />
        {lfo.sync ? (
          <ChipRow chips={DIVISION_CHIPS} value={lfo.division} onChange={(division) => set("lfo", { division })} />
        ) : (
          <CommitSlider
            label={(v) => `Velocidad ${v.toFixed(2)} Hz`}
            // Escala logarítmica de 0.05 a 10 Hz.
            toValue={(u) => Math.round(0.05 * Math.pow(200, u) * 100) / 100}
            fromValue={(hz) => Math.log(hz / 0.05) / Math.log(200)}
            value={lfo.rateHz}
            onCommit={(rateHz) => set("lfo", { rateHz })}
          />
        )}
        <CommitSlider label={(v) => `Profundidad ${v.toFixed(2)}`} value={lfo.depth} onCommit={(depth) => set("lfo", { depth })} />
      </View>
    );
  }

  if (source === "adsr") {
    const a = sources.adsr;
    const sec = { toValue: (u: number) => Math.round(u * 2 * 100) / 100, fromValue: (s: number) => s / 2 };
    return (
      <View style={styles.root}>
        <Text style={styles.note}>SE DISPARA AL APOYAR EL DEDO SOBRE LA IMAGEN</Text>
        <View style={styles.pair}>
          <CommitSlider label={(v) => `Ataque ${v.toFixed(2)} s`} {...sec} value={a.attack} onCommit={(attack) => set("adsr", { attack })} />
          <CommitSlider label={(v) => `Caída ${v.toFixed(2)} s`} {...sec} value={a.decay} onCommit={(decay) => set("adsr", { decay })} />
        </View>
        <View style={styles.pair}>
          <CommitSlider label={(v) => `Sostén ${v.toFixed(2)}`} value={a.sustain} onCommit={(sustain) => set("adsr", { sustain })} />
          <CommitSlider label={(v) => `Relajación ${v.toFixed(2)} s`} {...sec} value={a.release} onCommit={(release) => set("adsr", { release })} />
        </View>
      </View>
    );
  }

  if (source === "sh") {
    return (
      <View style={styles.root}>
        <Text style={styles.note}>DIVISIÓN DE PULSO</Text>
        <ChipRow chips={DIVISION_CHIPS} value={sources.sh.division} onChange={(division) => set("sh", { division })} />
        <CommitSlider label={(v) => `Deslizamiento ${v.toFixed(2)}`} value={sources.sh.slew} onCommit={(slew) => set("sh", { slew })} />
      </View>
    );
  }

  const seq = sources.seq;
  return (
    <View style={styles.root}>
      <StepBars steps={seq.steps} onCommit={(steps) => set("seq", { steps })} />
      <ChipRow
        chips={[{ id: 8, label: "8 PASOS" }, { id: 16, label: "16 PASOS" }]}
        value={seq.steps.length}
        onChange={(n) => set("seq", { steps: Array.from({ length: n }, (_, i) => seq.steps[i % seq.steps.length]) })}
      />
      <ChipRow chips={DIVISION_CHIPS} value={seq.division} onChange={(division) => set("seq", { division })} />
      <ChipRow chips={SEQ_DIRECTIONS.map((d) => ({ id: d, label: DIR_LABEL[d] }))} value={seq.direction} onChange={(direction) => set("seq", { direction })} />
    </View>
  );
}

/** Deslizador que se confirma al soltar. */
function CommitSlider({
  label,
  value,
  onCommit,
  toValue = (u) => Math.round(u * 100) / 100,
  fromValue = (v) => v,
}: {
  label: (v: number) => string;
  value: number;
  onCommit: (v: number) => void;
  toValue?: (u: number) => number;
  fromValue?: (v: number) => number;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  return (
    <Slider
      label={label(shown)}
      value={Math.min(1, Math.max(0, fromValue(shown)))}
      onChange={(u) => setDraft(toValue(u))}
      onSlidingEnd={() => {
        if (draft !== null) onCommit(draft);
        setDraft(null);
      }}
    />
  );
}

/** Pasos del secuenciador: toca o arrastra sobre cada barra para fijar su altura. */
function StepBars({ steps, onCommit }: { steps: number[]; onCommit: (steps: number[]) => void }) {
  const [draft, setDraft] = useState<number[] | null>(null);
  const size = useRef({ w: 1, h: 1 });
  const shown = draft ?? steps;
  const update = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const i = Math.min(shown.length - 1, Math.max(0, Math.floor((locationX / size.current.w) * shown.length)));
    const next = [...shown];
    next[i] = Math.round(Math.min(1, Math.max(0, 1 - locationY / size.current.h)) * 100) / 100;
    setDraft(next);
  };
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => (size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={update}
      onResponderMove={update}
      onResponderRelease={() => {
        if (draft) onCommit(draft);
        setDraft(null);
      }}
      style={styles.bars}
    >
      {shown.map((v, i) => (
        <View key={i} style={styles.barSlot}>
          <View style={[styles.bar, { height: `${Math.max(4, v * 100)}%` }]} />
        </View>
      ))}
    </View>
  );
}

function TempoEditor({ bpm, onTempo }: { bpm: number; onTempo: (bpm: number) => void }) {
  const taps = useRef<number[]>([]);
  const nudge = (d: number) => onTempo(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm + d)));
  return (
    <View style={[styles.root, styles.tempo]}>
      <Text style={styles.bpm}>{bpm} BPM</Text>
      <Btn label="−" onPress={() => nudge(-1)} />
      <Btn label="+" onPress={() => nudge(1)} />
      <Btn
        label="TAP"
        onPress={() => {
          const r = tapTempo(taps.current, Date.now());
          taps.current = r.taps;
          if (r.bpm !== null) onTempo(r.bpm);
        }}
      />
    </View>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.btn}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  pair: { flexDirection: "row", gap: 16 },
  note: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  bars: { flexDirection: "row", height: 56, gap: 2 },
  barSlot: { flex: 1, justifyContent: "flex-end", backgroundColor: "#222" },
  bar: { backgroundColor: colors.inkText },
  tempo: { flexDirection: "row", alignItems: "center", gap: 10 },
  bpm: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.title },
  btn: { minWidth: 44, minHeight: 36, alignItems: "center", justifyContent: "center", borderColor: colors.inkLineStrong, borderWidth: 1 },
  btnText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label },
});
