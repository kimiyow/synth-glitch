import type { SourceConfig } from "../state/types";

/**
 * Envolvente del micrófono (SEN-02, 3.5): nivel en dB → 0..1 entre piso y techo
 * calibrados, suavizado con ataque y relajación, y detección de golpes por umbral con
 * histéresis. Pura: el adaptador de plataforma la llama en cada lectura (cada ~50 ms).
 */
export type MicEnvelope = {
  /** Nivel suavizado 0..1. */
  level: number;
  /** El nivel está por encima del umbral (se rearma al bajar por debajo de umbral − histéresis). */
  above: boolean;
};

export const MIC_SILENT: MicEnvelope = { level: 0, above: false };
/** Histéresis del golpe: evita disparos repetidos cuando el nivel tiembla en el umbral. */
export const HIT_HYSTERESIS = 0.1;
/** Margen sobre el ruido de la sala al calibrar: el silencio queda por debajo del piso. */
export const CALIBRATION_MARGIN_DB = 6;
/** Rango mínimo entre piso y techo. */
export const MIN_RANGE_DB = 10;

export function dbToUnit(db: number, floor: number, ceiling: number): number {
  const range = Math.max(1e-3, ceiling - floor);
  return Math.min(1, Math.max(0, (db - floor) / range));
}

/** Un paso de la envolvente: `dtS` segundos desde la lectura anterior. `hit` = golpe nuevo. */
export function stepMic(
  prev: MicEnvelope,
  db: number,
  dtS: number,
  cfg: SourceConfig["mic"],
): { env: MicEnvelope; hit: boolean } {
  const target = Number.isFinite(db) ? dbToUnit(db, cfg.floor, cfg.ceiling) : 0;
  const time = target > prev.level ? cfg.attack : cfg.release;
  // Filtro de un polo: con tiempo 0 sigue al objetivo de inmediato.
  const k = time <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dtS) / time);
  const level = prev.level + (target - prev.level) * k;
  const hit = !prev.above && level >= cfg.hitThreshold;
  const above = prev.above ? level > cfg.hitThreshold - HIT_HYSTERESIS : hit;
  return { env: { level, above }, hit };
}

/** Calibración (3.5): con 2 s de silencio, el piso queda sobre el ruido de la sala. */
export function calibrateFloor(samplesDb: readonly number[], cfg: SourceConfig["mic"]): SourceConfig["mic"] {
  const valid = samplesDb.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return cfg;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  const peak = Math.max(...valid);
  const floor = Math.min(-MIN_RANGE_DB, Math.max(-120, Math.max(avg, peak - 3) + CALIBRATION_MARGIN_DB));
  return { ...cfg, floor: Math.round(floor), ceiling: Math.max(cfg.ceiling, Math.round(floor) + MIN_RANGE_DB) };
}
