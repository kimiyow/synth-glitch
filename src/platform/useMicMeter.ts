import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { MIC_SILENT, stepMic, type MicEnvelope } from "../modulation/micEnvelope";
import type { SourceConfig } from "../state/types";

/** 3.5: se sondea el grabador cada 50 ms. */
export const MIC_POLL_MS = 50;
/** El grabador escribe un archivo mientras mide: se rota y se borra cada 60 s (3.5). */
export const MIC_ROTATE_MS = 60_000;
/** Duración de la calibración con la sala en silencio. */
export const CALIBRATION_MS = 2000;

export type MicState = "off" | "starting" | "on" | "denied" | "error";

export type MicMeter = {
  state: MicState;
  /** Nivel 0..1 para la modulación (hilo de UI lo lee por cuadro; JS lo escribe). */
  level: SharedValue<number>;
  /** Contador de golpes: el lienzo dispara el ADSR cuando cambia (sin llamar a JS desde UI). */
  hits: SharedValue<number>;
  /** Último nivel en dB, para el medidor del panel (se actualiza cada ~200 ms). */
  db: number | null;
  /** Intervalo medio real entre lecturas (SP-07), en ms. */
  pollMs: number | null;
  /** Escucha 2 s y devuelve las lecturas en dB (calibración del piso). */
  sample(ms?: number): Promise<number[]>;
};

/**
 * Micrófono como fuente (SEN-02, ADR-11): `expo-audio` con medición; solo activo con
 * `active` (hay rutas de MIC o se está calibrando, y el editor está a la vista).
 */
export function useMicMeter(active: boolean, cfg: SourceConfig["mic"]): MicMeter {
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const level = useSharedValue(0);
  const hits = useSharedValue(0);
  const [state, setState] = useState<MicState>("off");
  const [db, setDb] = useState<number | null>(null);
  const [pollMs, setPollMs] = useState<number | null>(null);
  const cfgRef = useRef(cfg);
  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);
  const listeners = useRef(new Set<(db: number) => void>());

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let rotate: ReturnType<typeof setInterval> | null = null;
    let env: MicEnvelope = MIC_SILENT;
    let last = Date.now();
    let lastUi = 0;
    const intervals: number[] = [];

    const removeFile = (uri: string | null) => {
      try {
        if (uri) {
          const f = new File(uri);
          if (f.exists) f.delete();
        }
      } catch {
        // Un temporal que no se pudo borrar lo limpia el sistema (caché).
      }
    };

    const start = async () => {
      setState("starting");
      const permission = await requestRecordingPermissionsAsync();
      if (stopped) return;
      if (!permission.granted) return setState("denied");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (stopped) return;
      recorder.record();
      setState("on");

      poll = setInterval(() => {
        const now = Date.now();
        const dt = (now - last) / 1000;
        intervals.push(now - last);
        if (intervals.length > 40) intervals.shift();
        last = now;
        const metering = recorder.getStatus().metering;
        const value = typeof metering === "number" ? metering : -160;
        const r = stepMic(env, value, dt, cfgRef.current);
        env = r.env;
        level.set(env.level);
        if (r.hit) hits.set(hits.get() + 1);
        for (const l of listeners.current) l(value);
        if (now - lastUi > 200) {
          lastUi = now;
          setDb(value);
          setPollMs(intervals.reduce((a, b) => a + b, 0) / intervals.length);
        }
      }, MIC_POLL_MS);

      // Rotación: se detiene, se borra el archivo y se vuelve a grabar.
      rotate = setInterval(() => {
        void (async () => {
          const old = recorder.uri;
          await recorder.stop();
          removeFile(old);
          if (stopped) return;
          await recorder.prepareToRecordAsync();
          recorder.record();
        })();
      }, MIC_ROTATE_MS);
    };

    start().catch(() => setState("error"));

    return () => {
      stopped = true;
      if (poll) clearInterval(poll);
      if (rotate) clearInterval(rotate);
      level.set(0);
      setState("off");
      setDb(null);
      void (async () => {
        try {
          const old = recorder.uri;
          await recorder.stop();
          removeFile(old);
          await setAudioModeAsync({ allowsRecording: false });
        } catch {
          // Si el grabador ya estaba detenido no hay nada que limpiar.
        }
      })();
    };
  }, [active, recorder, level, hits]);

  const sample = (ms = CALIBRATION_MS) =>
    new Promise<number[]>((resolve) => {
      const out: number[] = [];
      const l = (v: number) => out.push(v);
      listeners.current.add(l);
      setTimeout(() => {
        listeners.current.delete(l);
        resolve(out);
      }, ms);
    });

  return { state, level, hits, db, pollMs, sample };
}
