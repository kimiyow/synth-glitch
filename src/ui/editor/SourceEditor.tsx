import { useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

import { dbToUnit } from "../../modulation/micEnvelope";
import { DIVISIONS, LFO_SHAPES, MAX_BPM, MIN_BPM, SEQ_DIRECTIONS } from "../../modulation/sources";
import { tapTempo } from "../../modulation/tempo";
import type { SourceConfig } from "../../state/types";
import { ChipRow } from "../ChipRow";
import { Slider } from "../Slider";
import { colors, type } from "../tokens";

export type ModSourceId = "lfo" | "adsr" | "sh" | "seq" | "tempo" | "mic";

/** Estado del micrófono para su editor (lo da el adaptador de plataforma). */
export type MicView = {
  state: "off" | "starting" | "on" | "denied" | "error";
  db: number | null;
  calibrating: boolean;
  onCalibrate: () => void;
};

type Props = {
  source: ModSourceId;
  sources: SourceConfig;
  /** Cambio confirmado de una fuente (deshacible). */
  onChange: (next: SourceConfig) => void;
  /** Tempo: no entra al historial (3.8). */
  onTempo: (bpm: number) => void;
  mic?: MicView;
};

const DIVISION_CHIPS = DIVISIONS.map((d) => ({ id: d, label: d < 1 ? `1/${1 / d}` : `${d}` }));
const SHAPE_LABEL = { sine: "SENO", triangle: "TRIÁNGULO", square: "CUADRADA", saw: "SIERRA", random: "ALEATORIA" };
const DIR_LABEL = { forward: "ADELANTE", backward: "ATRÁS", pingpong: "IDA Y VUELTA", random: "ALEATORIO" };

/** Ajustes de una fuente de modulación (categoría MOD del panel Efectos). */
export function SourceEditor({ source, sources, onChange, onTempo, mic }: Props) {
  const set = <K extends keyof SourceConfig>(key: K, patch: Partial<SourceConfig[K]>) =>
    onChange({ ...sources, [key]: { ...sources[key], ...patch } });

  if (source === "tempo") return <TempoEditor bpm={sources.tempo.bpm} onTempo={onTempo} />;

  if (source === "mic") {
    const m = sources.mic;
    const dbSlider = (lo: number, hi: number) => ({
      toValue: (u: number) => Math.round(lo + u * (hi - lo)),
      fromValue: (v: number) => (v - lo) / (hi - lo),
    });
    if (mic?.state === "denied") {
      return (
        <View style={styles.root}>
          <Text style={styles.note}>SIN PERMISO DE MICRÓFONO · ACTÍVALO EN AJUSTES</Text>
          <Btn label="ABRIR AJUSTES" onPress={() => void Linking.openSettings()} />
        </View>
      );
    }
    const unit = mic?.db === null || mic?.db === undefined ? 0 : dbToUnit(mic.db, m.floor, m.ceiling);
    return (
      <View style={styles.root}>
        <View style={styles.meter}>
          <View style={[styles.meterFill, { width: `${Math.round(unit * 100)}%` }]} />
          <View style={[styles.meterMark, { left: `${Math.round(m.hitThreshold * 100)}%` }]} />
        </View>
        <View style={styles.micRow}>
          <Text style={styles.note}>
            {mic?.state === "on"
              ? `${mic.db === null ? "—" : Math.round(mic.db)} dB · PISO ${m.floor} · TECHO ${m.ceiling}`
              : mic?.state === "error"
                ? "NO SE PUDO ABRIR EL MICRÓFONO"
                : "ABRIENDO MICRÓFONO…"}
          </Text>
          <Btn label={mic?.calibrating ? "ESCUCHANDO 2 S…" : "CALIBRAR"} onPress={() => mic?.onCalibrate()} />
        </View>
        <Text style={styles.note}>CALIBRAR: GUARDA SILENCIO 2 S PARA FIJAR EL PISO DE LA SALA</Text>
        <View style={styles.pair}>
          <CommitSlider label={(v) => `Piso ${v} dB`} {...dbSlider(-90, -20)} value={m.floor} onCommit={(floor) => set("mic", { floor: Math.min(floor, m.ceiling - 10) })} />
          <CommitSlider label={(v) => `Techo ${v} dB`} {...dbSlider(-60, 0)} value={m.ceiling} onCommit={(ceiling) => set("mic", { ceiling: Math.max(ceiling, m.floor + 10) })} />
        </View>
        <View style={styles.pair}>
          <CommitSlider label={(v) => `Ataque ${v.toFixed(2)} s`} toValue={(u) => Math.round(u * 50) / 100} fromValue={(v) => v / 0.5} value={m.attack} onCommit={(attack) => set("mic", { attack })} />
          <CommitSlider label={(v) => `Relajación ${v.toFixed(2)} s`} toValue={(u) => Math.round(u * 200) / 100} fromValue={(v) => v / 2} value={m.release} onCommit={(release) => set("mic", { release })} />
        </View>
        <CommitSlider label={(v) => `Umbral de golpe ${v.toFixed(2)}`} value={m.hitThreshold} onCommit={(hitThreshold) => set("mic", { hitThreshold })} />
      </View>
    );
  }

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
  meter: { height: 8, borderRadius: 4, backgroundColor: colors.inkRaised, overflow: "hidden" },
  meterFill: { height: 8, backgroundColor: colors.inkText },
  meterMark: { position: "absolute", top: 0, width: 2, height: 8, backgroundColor: colors.inkMute },
  micRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  btn: {
    minWidth: 44,
    minHeight: 36,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: 1,
  },
  btnText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label },
});
