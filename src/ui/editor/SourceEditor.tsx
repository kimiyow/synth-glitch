import { useContext, useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

import type { Route, RouteSettings, SourceConfig } from "../../domain/types";
import { dbToUnit } from "../../modulation/micEnvelope";
import { DEFAULT_MIC_ROUTE, DIVISIONS, LFO_SHAPES, MAX_BPM, MIN_BPM, SEQ_DIRECTIONS } from "../../modulation/sources";
import { tapTempo } from "../../modulation/tempo";
import { ChipRow } from "../ChipRow";
import { Icon } from "../kit/Icon";
import { Segmented } from "../kit/Segmented";
import { SheetScrollLock } from "../kit/Sheet";
import { Slider } from "../Slider";
import { colors, radius, space, type } from "../tokens";
import { useGestureRecord } from "./gestureRecord";
import { useLiveMod } from "../../canvas/modBus";

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
  return ["lfo", "adsr", "sh", "seq", "orientation"].includes(route.source);
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

  if (route.source === "orientation") {
    const o = own.orientation ?? scene.orientation;
    if (advanced) {
      return (
        <View style={styles.root}>
          <CommitSlider
            label="Zona muerta"
            format={(v) => `${Math.round(v * 100)} %`}
            toValue={(u) => Math.round(u * 30) / 100}
            fromValue={(v) => v / 0.3}
            value={o.deadzone}
            onCommit={(deadzone) => patch("orientation", "zona muerta del giro", { deadzone })}
          />
          <Segmented
            options={[
              { id: "normal", label: "↔ X · ↕ Y" },
              { id: "swap", label: "↔ Y · ↕ X" },
            ]}
            value={o.swapAxes ? "swap" : "normal"}
            onChange={(v) => patch("orientation", "ejes del giro", { swapAxes: v === "swap" })}
          />
        </View>
      );
    }
    return (
      <View style={styles.root}>
        <View style={styles.micRow}>
          <GyroStatus />
          <RecalibrateButton />
        </View>
        <CommitSlider
          label="Sensibilidad"
          format={(v) => `×${v.toFixed(2)}`}
          toValue={(u) => Math.round(0.25 * Math.pow(16, u) * 100) / 100}
          fromValue={(g) => Math.log(g / 0.25) / Math.log(16)}
          value={o.sensitivity}
          onCommit={(sensitivity) => patch("orientation", "sensibilidad del giro", { sensitivity })}
        />
      </View>
    );
  }

  if (route.source === "track") {
    if (advanced) return null;
    return <GestureSummary route={route} />;
  }

  if (route.source === "mic") {
    if (advanced) return null;
    const m = own.mic ?? DEFAULT_MIC_ROUTE;
    return (
      <View style={styles.root}>
        {mic.state === "denied" || mic.state === "error" ? <MicStatus mic={mic} /> : <MicCheck mic={mic} scene={scene.mic} />}
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

// instrucción o aviso si el teléfono no da lecturas de movimiento. JS consulta el valor numérico
// que escribe el sensor (sin llamadas desde el hilo de UI)
function GyroStatus() {
  const live = useLiveMod();
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    const bus = live?.bus;
    if (!bus) return;
    const id = setInterval(() => setAvailable(bus.oriAvailable.get() === 1), 500);
    return () => clearInterval(id);
  }, [live]);
  return available ? (
    <Text style={[styles.note, styles.flex]}>INCLINA EL TELÉFONO</Text>
  ) : (
    <Text style={[styles.warn, styles.flex]}>SIN SENSOR DE MOVIMIENTO · NO HAY GIRO EN ESTE DISPOSITIVO</Text>
  );
}

// fija como centro la posición actual del teléfono
function RecalibrateButton() {
  const live = useLiveMod();
  return (
    <Btn
      label="RECALIBRAR"
      onPress={() => {
        const bus = live?.bus;
        if (bus) bus.oriCalibrate.set(bus.oriCalibrate.get() + 1);
      }}
    />
  );
}

// la fuente GESTO en Modulación: solo el resumen. Grabar, transformar y guardar se hacen en el
// panel Gesto, que se abre encima
function GestureSummary({ route }: { route: Route }) {
  const rec = useGestureRecord();
  const g = route.settings?.gesture;
  const has = !!g && g.samples.length >= 4;
  return (
    <View style={styles.micRow}>
      <Text style={[styles.note, styles.flex]}>{has ? `EN BUCLE · ${(g.durationMs / 1000).toFixed(1)} S` : "SIN GESTO GRABADO"}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Abre el panel Gesto para grabar, transformar o guardar el gesto"
        hitSlop={{ top: 6, bottom: 6 }}
        onPress={() => rec?.open()}
        style={({ pressed }) => [styles.btn, styles.btnRow, pressed && styles.pressed]}
      >
        {has ? <Icon name="hand.draw" size={13} /> : <View style={styles.recDotSmall} />}
        <Text style={styles.btnText}>{has ? "EDITAR EN GESTO" : "GRABAR EN GESTO"}</Text>
      </Pressable>
    </View>
  );
}

// cuánto tiempo seguido en silencio o saturado antes de avisar
const MIC_HEALTH_MS = 3000;

// medidor del micrófono dentro de la tarjeta, con CALIBRAR al lado. Si la señal pasa 3 s casi en
// cero (sala más ruidosa que el piso, o techo muy alto) o pegada al máximo, dice por qué y qué hacer
function MicCheck({ mic, scene }: { mic: MicView; scene: SourceConfig["mic"] }) {
  const health = useMicHealth(mic, scene);
  return (
    <View style={styles.micCheck}>
      <View style={styles.micRow}>
        <MicMeter mic={mic} scene={scene} />
        <Btn label={mic.calibrating ? "ESCUCHANDO…" : "CALIBRAR"} onPress={mic.onCalibrate} />
      </View>
      {mic.calibrating ? (
        <Text style={styles.note}>GUARDA SILENCIO 2 S</Text>
      ) : health === "quiet" ? (
        <Text style={styles.warn}>NO LLEGA SONIDO · CALIBRA O SUBE LA SENSIBILIDAD</Text>
      ) : health === "loud" ? (
        <Text style={styles.warn}>SATURADO · CALIBRA O BAJA LA SENSIBILIDAD</Text>
      ) : null}
    </View>
  );
}

// "quiet" / "loud" si el nivel lleva MIC_HEALTH_MS por debajo de 3 % o por encima de 97 %
function useMicHealth(mic: MicView, scene: SourceConfig["mic"]): "ok" | "quiet" | "loud" {
  const since = useRef<{ kind: "ok" | "quiet" | "loud"; at: number }>({ kind: "ok", at: 0 });
  const [health, setHealth] = useState<"ok" | "quiet" | "loud">("ok");
  useEffect(() => {
    if (mic.state !== "on" || mic.db === null || mic.calibrating) return;
    const u = dbToUnit(mic.db, scene.floor, scene.ceiling);
    const kind = u < 0.03 ? "quiet" : u > 0.97 ? "loud" : "ok";
    const now = Date.now();
    if (kind !== since.current.kind) since.current = { kind, at: now };
    const next = kind !== "ok" && now - since.current.at >= MIC_HEALTH_MS ? kind : "ok";
    setHealth((h) => (h === next ? h : next));
  }, [mic.db, mic.state, mic.calibrating, scene.floor, scene.ceiling]);
  return health;
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
      {/* valor y −/+ son un solo control para VoiceOver: desliza arriba o abajo para cambiar 1 BPM */}
      <View
        style={styles.tempoValue}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Tempo"
        accessibilityValue={{ min: MIN_BPM, max: MAX_BPM, now: bpm, text: `${bpm} BPM` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
      >
        <Text style={styles.bpm}>
          {bpm} <Text style={styles.bpmUnit}>BPM</Text>
        </Text>
        <Btn label="−" onPress={() => nudge(-1)} />
        <Btn label="+" onPress={() => nudge(1)} />
      </View>
      <Btn
        label="TAP"
        a11yLabel="Marcar el tempo"
        a11yHint="Toca varias veces al ritmo"
        onPress={() => {
          const r = tapTempo(taps.current, Date.now());
          taps.current = r.taps;
          if (r.bpm !== null) onTempo(r.bpm);
        }}
      />
    </View>
  );
}

function Btn({ label, a11yLabel, a11yHint, onPress }: { label: string; a11yLabel?: string; a11yHint?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11yLabel} accessibilityHint={a11yHint} onPress={onPress} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  flex: { flex: 1 },
  pair: { flexDirection: "row", gap: space.lg },
  note: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  // aviso: texto claro sobre gris oscuro (sin color de acento, como el resto de la app)
  warn: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1 },
  micCheck: { gap: 6 },
  section: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, fontWeight: "600", letterSpacing: 1.2 },
  sectionGap: { marginTop: space.sm },
  bars: { flexDirection: "row", height: 64, gap: 3 },
  barSlot: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.inkRaised, borderRadius: 3, overflow: "hidden" },
  bar: { backgroundColor: colors.inkText, borderRadius: 2 },
  tempo: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tempoValue: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm },
  bpm: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.display, fontWeight: "300", fontVariant: ["tabular-nums"] },
  bpmUnit: { color: colors.inkMute, fontSize: type.label, fontWeight: "400" },
  meterWrap: { flex: 1, gap: 4 },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.inkRaised, overflow: "hidden" },
  meterFill: { height: 6, backgroundColor: colors.inkText },
  meterMark: { position: "absolute", top: 0, width: 2, height: 6, backgroundColor: colors.inkMute },
  micRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  btn: {
    minWidth: 44,
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.inkRaised,
  },
  pressed: { opacity: 0.6 },
  btnText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label },
  btnRow: { flexDirection: "row", gap: 6 },
  recBig: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  recBigText: { color: colors.paperText, fontFamily: type.family, fontSize: type.label, fontWeight: "700", letterSpacing: 1.2 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.paperText },
  recDotSmall: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkText },
});
