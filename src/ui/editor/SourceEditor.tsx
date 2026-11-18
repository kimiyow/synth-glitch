import { useContext, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

import type { Route, RouteSettings, SourceConfig } from "../../domain/types";
import { dbToUnit } from "../../modulation/micEnvelope";
import { DEFAULT_MIC_ROUTE, DIVISIONS, LFO_SHAPES, MAX_BPM, MIN_BPM, SEQ_DIRECTIONS } from "../../modulation/sources";
import { tapTempo } from "../../modulation/tempo";
import { ChipRow } from "../ChipRow";
import { Segmented } from "../kit/Segmented";
import { SheetScrollLock } from "../kit/Sheet";
import { Slider } from "../Slider";
import { colors, radius, space, type } from "../tokens";

// estado del micrófono (lo da el adaptador de plataforma)
export type MicView = {
  state: "off" | "starting" | "on" | "denied" | "error";
  db: number | null;
  calibrating: boolean;
  onCalibrate: () => void;
};

const DIVISION_CHIPS = DIVISIONS.map((d) => ({ id: d, label: d < 1 ? `1/${1 / d}` : `${d}` }));
const SHAPE_LABEL = { sine: "SENO", triangle: "TRIÁNGULO", square: "CUADRADA", saw: "SIERRA", random: "ALEATORIA" };
const DIR_LABEL = { forward: "→", backward: "←", pingpong: "↔", random: "?" };
const secs = (v: number) => `${v.toFixed(2)} s`;
const two = (v: number) => v.toFixed(2);

type Patch = <K extends keyof RouteSettings>(key: K, label: string, patch: Partial<NonNullable<RouteSettings[K]>>) => void;

type RouteProps = {
  route: Route;
  scene: SourceConfig;
  mic: MicView;
  patch: Patch;
  // básicos: lo que cambia el carácter de la señal (siempre a la vista); avanzados: el resto
  advanced?: boolean;
};

// true si la fuente tiene ajustes avanzados (para mostrar "Más ajustes")
export function hasAdvanced(route: Route): boolean {
  return route.source === "lfo" || route.source === "adsr" || route.source === "sh" || route.source === "seq";
}

// ajustes propios de la fuente de una modulación
export function RouteSourceEditor({ route, scene, mic, patch, advanced = false }: RouteProps) {
  const own = route.settings ?? {};

  if (route.source === "lfo") {
    const lfo = own.lfo ?? scene.lfo;
    if (advanced) {
      return (
        <View style={styles.root}>
          <Segmented
            options={[
              { id: "free", label: "LIBRE" },
              { id: "sync", label: `AL RELOJ · ${scene.tempo.bpm}` },
            ]}
            value={lfo.sync ? "sync" : "free"}
            onChange={(m) => patch("lfo", "modo del LFO", { sync: m === "sync" })}
          />
          <View style={styles.pair}>
            <CommitSlider label="Profundidad" format={two} value={lfo.depth} onCommit={(depth) => patch("lfo", "profundidad del LFO", { depth })} />
            <CommitSlider label="Desfase" format={(v) => `${Math.round(v * 360)}°`} value={lfo.phase} onCommit={(phase) => patch("lfo", "desfase del LFO", { phase })} />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.root}>
        <ChipRow chips={LFO_SHAPES.map((s) => ({ id: s, label: SHAPE_LABEL[s] }))} value={lfo.shape} onChange={(shape) => patch("lfo", "forma del LFO", { shape })} />
        {lfo.sync ? (
          <ChipRow chips={DIVISION_CHIPS} value={lfo.division} onChange={(division) => patch("lfo", "división del LFO", { division })} />
        ) : (
          <CommitSlider
            label="Velocidad"
            format={(v) => `${v.toFixed(2)} Hz`}
            // escala logarítmica de 0.05 a 10 Hz
            toValue={(u) => Math.round(0.05 * Math.pow(200, u) * 100) / 100}
            fromValue={(hz) => Math.log(hz / 0.05) / Math.log(200)}
            value={lfo.rateHz}
            onCommit={(rateHz) => patch("lfo", "velocidad del LFO", { rateHz })}
          />
        )}
      </View>
    );
  }

  if (route.source === "adsr") {
    const a = own.adsr ?? { ...scene.adsr, trigger: "touch" as const };
    const sec = { toValue: (u: number) => Math.round(u * 2 * 100) / 100, fromValue: (s: number) => s / 2 };
    if (advanced) {
      return (
        <View style={styles.pair}>
          <CommitSlider label="Caída" format={secs} {...sec} value={a.decay} onCommit={(decay) => patch("adsr", "caída", { decay })} />
          <CommitSlider label="Sostén" format={two} value={a.sustain} onCommit={(sustain) => patch("adsr", "sostén", { sustain })} />
        </View>
      );
    }
    return (
      <View style={styles.root}>
        <Segmented
          options={[
            { id: "touch", label: "AL TOCAR" },
            { id: "mic", label: "GOLPE DE MIC" },
          ]}
          value={a.trigger}
          onChange={(trigger) => patch("adsr", "disparo del ADSR", { trigger })}
        />
        <View style={styles.pair}>
          <CommitSlider label="Sube" format={secs} {...sec} value={a.attack} onCommit={(attack) => patch("adsr", "ataque", { attack })} />
          <CommitSlider label="Baja" format={secs} {...sec} value={a.release} onCommit={(release) => patch("adsr", "relajación", { release })} />
        </View>
      </View>
    );
  }

  if (route.source === "sh") {
    const sh = own.sh ?? scene.sh;
    if (advanced) {
      return <CommitSlider label="Suavizado" format={two} value={sh.slew} onCommit={(slew) => patch("sh", "suavizado del azar", { slew })} />;
    }
    return <ChipRow chips={DIVISION_CHIPS} value={sh.division} onChange={(division) => patch("sh", "división del azar", { division })} />;
  }

  if (route.source === "seq") {
    const seq = own.seq ?? scene.seq;
    if (advanced) {
      return (
        <View style={styles.root}>
          <Segmented
            options={[
              { id: 8, label: "8 PASOS" },
              { id: 16, label: "16 PASOS" },
            ]}
            value={seq.steps.length}
            onChange={(n) => patch("seq", "largo de la secuencia", { steps: Array.from({ length: n }, (_, i) => seq.steps[i % seq.steps.length]) })}
          />
          <ChipRow chips={DIVISION_CHIPS} value={seq.division} onChange={(division) => patch("seq", "división de pasos", { division })} />
          <Segmented options={SEQ_DIRECTIONS.map((d) => ({ id: d, label: DIR_LABEL[d] }))} value={seq.direction} onChange={(direction) => patch("seq", "dirección", { direction })} />
        </View>
      );
    }
    return <StepBars steps={seq.steps} onCommit={(steps) => patch("seq", "pasos", { steps })} />;
  }

  if (route.source === "mic") {
    if (advanced) return null;
    const m = own.mic ?? DEFAULT_MIC_ROUTE;
    return (
      <View style={styles.root}>
        {mic.state !== "on" && <MicStatus mic={mic} />}
        <Segmented
          options={[
            { id: "level", label: "VOLUMEN" },
            { id: "hit", label: "GOLPES" },
          ]}
          value={m.mode}
          onChange={(mode) => patch("mic", "respuesta al micrófono", { mode })}
        />
        {m.mode === "level" ? (
          <CommitSlider
            label="Sensibilidad"
            format={(v) => `×${v.toFixed(2)}`}
            toValue={(u) => Math.round(0.25 * Math.pow(16, u) * 100) / 100}
            fromValue={(g) => Math.log(g / 0.25) / Math.log(16)}
            value={m.gain}
            onCommit={(gain) => patch("mic", "sensibilidad", { gain })}
          />
        ) : (
          <CommitSlider
            label="Duración"
            format={secs}
            toValue={(u) => Math.round((0.05 + u * 1.95) * 100) / 100}
            fromValue={(d) => (d - 0.05) / 1.95}
            value={m.decay}
            onCommit={(decay) => patch("mic", "duración del pulso", { decay })}
          />
        )}
      </View>
    );
  }

  // tempo (pulso): sin ajustes propios
  return null;
}

function MicStatus({ mic }: { mic: MicView }) {
  return (
    <Text style={styles.note}>
      {mic.state === "denied" ? "SIN PERMISO DE MICRÓFONO" : mic.state === "error" ? "NO SE PUDO ABRIR EL MICRÓFONO" : "ABRIENDO MICRÓFONO…"}
    </Text>
  );
}

// ajustes de toda la escena: el reloj y la calibración del micrófono (dependen de la sala, no del
// efecto)
export function GlobalSourcesEditor({
  sources,
  onSources,
  onTempo,
  mic,
}: {
  sources: SourceConfig;
  onSources: (next: SourceConfig) => void;
  onTempo: (bpm: number) => void;
  mic: MicView;
}) {
  const m = sources.mic;
  const set = (patch: Partial<SourceConfig["mic"]>) => onSources({ ...sources, mic: { ...m, ...patch } });
  const dbSlider = (lo: number, hi: number) => ({
    toValue: (u: number) => Math.round(lo + u * (hi - lo)),
    fromValue: (v: number) => (v - lo) / (hi - lo),
  });
  const db = (v: number) => `${v} dB`;
  return (
    <View style={styles.root}>
      <Text style={styles.section}>RELOJ</Text>
      <TempoEditor bpm={sources.tempo.bpm} onTempo={onTempo} />

      <Text style={[styles.section, styles.sectionGap]}>MICRÓFONO</Text>
      {mic.state === "denied" ? (
        <View style={styles.micRow}>
          <MicStatus mic={mic} />
          <Btn label="AJUSTES" onPress={() => void Linking.openSettings()} />
        </View>
      ) : (
        <>
          <View style={styles.micRow}>
            <MicMeter mic={mic} scene={m} />
            <Btn label={mic.calibrating ? "ESCUCHANDO…" : "CALIBRAR"} onPress={mic.onCalibrate} />
          </View>
          <View style={styles.pair}>
            <CommitSlider label="Piso" format={db} {...dbSlider(-90, -20)} value={m.floor} onCommit={(floor) => set({ floor: Math.min(floor, m.ceiling - 10) })} />
            <CommitSlider label="Techo" format={db} {...dbSlider(-60, 0)} value={m.ceiling} onCommit={(ceiling) => set({ ceiling: Math.max(ceiling, m.floor + 10) })} />
          </View>
          <View style={styles.pair}>
            <CommitSlider label="Ataque" format={secs} toValue={(u) => Math.round(u * 50) / 100} fromValue={(v) => v / 0.5} value={m.attack} onCommit={(attack) => set({ attack })} />
            <CommitSlider label="Relajación" format={secs} toValue={(u) => Math.round(u * 200) / 100} fromValue={(v) => v / 2} value={m.release} onCommit={(release) => set({ release })} />
          </View>
          <CommitSlider label="Umbral de golpe" format={two} value={m.hitThreshold} onCommit={(hitThreshold) => set({ hitThreshold })} />
        </>
      )}
    </View>
  );
}

// medidor del micrófono; la marca es el umbral de golpe
function MicMeter({ mic, scene }: { mic: MicView; scene: SourceConfig["mic"] }) {
  const unit = mic.db === null ? 0 : dbToUnit(mic.db, scene.floor, scene.ceiling);
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meter}>
        <View style={[styles.meterFill, { width: `${Math.round(unit * 100)}%` }]} />
        <View style={[styles.meterMark, { left: `${Math.round(scene.hitThreshold * 100)}%` }]} />
      </View>
      <Text style={styles.note}>{mic.state === "on" ? `${mic.db === null ? "—" : Math.round(mic.db)} dB` : "…"}</Text>
    </View>
  );
}

// deslizador que se confirma al soltar; el valor formateado va a la derecha
export function CommitSlider({
  label,
  format,
  value,
  onCommit,
  toValue = (u) => Math.round(u * 100) / 100,
  fromValue = (v) => v,
}: {
  label: string;
  format: (v: number) => string;
  value: number;
  onCommit: (v: number) => void;
  toValue?: (u: number) => number;
  fromValue?: (v: number) => number;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  return (
    <View style={styles.flex}>
      <Slider
        label={label}
        valueText={format(shown)}
        value={Math.min(1, Math.max(0, fromValue(shown)))}
        onChange={(u) => setDraft(toValue(u))}
        onSlidingEnd={() => {
          if (draft !== null) onCommit(draft);
          setDraft(null);
        }}
      />
    </View>
  );
}

// pasos del secuenciador: toca o arrastra sobre las barras. Las barras no reciben toques (así
// locationX es siempre relativo al contenedor) y la hoja no se desplaza mientras se dibuja
function StepBars({ steps, onCommit }: { steps: number[]; onCommit: (steps: number[]) => void }) {
  const [draft, setDraft] = useState<number[] | null>(null);
  const size = useRef({ w: 1, h: 1 });
  const lockSheet = useContext(SheetScrollLock);
  const shown = draft ?? steps;
  const update = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const i = Math.min(shown.length - 1, Math.max(0, Math.floor((locationX / size.current.w) * shown.length)));
    const next = [...shown];
    next[i] = Math.round(Math.min(1, Math.max(0, 1 - locationY / size.current.h)) * 100) / 100;
    setDraft(next);
  };
  const end = () => {
    lockSheet(false);
    if (draft) onCommit(draft);
    setDraft(null);
  };
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => (size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        lockSheet(true);
        update(e);
      }}
      onResponderMove={update}
      onResponderRelease={end}
      onResponderTerminate={end}
      style={styles.bars}
    >
      {shown.map((v, i) => (
        <View key={i} style={styles.barSlot} pointerEvents="none">
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
    <View style={styles.tempo}>
      <Text style={styles.bpm}>
        {bpm} <Text style={styles.bpmUnit}>BPM</Text>
      </Text>
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
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  flex: { flex: 1 },
  pair: { flexDirection: "row", gap: space.lg },
  note: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  section: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2 },
  sectionGap: { marginTop: space.sm },
  bars: { flexDirection: "row", height: 64, gap: 3 },
  barSlot: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.inkRaised, borderRadius: 3, overflow: "hidden" },
  bar: { backgroundColor: colors.inkText, borderRadius: 2 },
  tempo: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bpm: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.display, fontWeight: "300", fontVariant: ["tabular-nums"] },
  bpmUnit: { color: colors.inkMute, fontSize: type.label, fontWeight: "400" },
  meterWrap: { flex: 1, gap: 4 },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.inkRaised, overflow: "hidden" },
  meterFill: { height: 6, backgroundColor: colors.inkText },
  meterMark: { position: "absolute", top: 0, width: 2, height: 6, backgroundColor: colors.inkMute },
  micRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  btn: {
    minWidth: 44,
    height: 34,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.inkRaised,
  },
  pressed: { opacity: 0.6 },
  btnText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label },
});
