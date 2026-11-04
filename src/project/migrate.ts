import type { Project } from "../state/types";
import { SCHEMA_VERSION, validateProject } from "./schema";

/** Una función por versión: `migrations[n]` convierte un JSON de la versión n a la n + 1. */
export type Migrations = Readonly<Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>>;

/** Vacío mientras solo exista la versión 1. */
export const MIGRATIONS: Migrations = {};

export type LoadResult =
  | { ok: true; project: Project; readOnly: boolean; migratedFrom: number | null }
  | { ok: false; error: string };

/**
 * Lleva un `project.json` ya parseado a la versión actual (PRJ-05).
 * - Versión antigua: se migra paso a paso y luego se valida.
 * - Versión futura: se intenta leer tal cual y se abre en solo lectura.
 */
export function loadProject(
  raw: unknown,
  migrations: Migrations = MIGRATIONS,
  currentVersion: number = SCHEMA_VERSION,
): LoadResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "EL ARCHIVO NO ES UN PROYECTO" };
  }
  const version = (raw as Record<string, unknown>).schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: "VERSIÓN DE PROYECTO DESCONOCIDA" };
  }

  if (version > currentVersion) {
    const result = validateProject(raw);
    return result.ok
      ? { ok: true, project: result.value, readOnly: true, migratedFrom: null }
      : { ok: false, error: `PROYECTO DE UNA VERSIÓN MÁS NUEVA (${version}) · ACTUALIZA LA APP` };
  }

  let current = raw as Record<string, unknown>;
  for (let v = version; v < currentVersion; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, error: `FALTA LA MIGRACIÓN DE LA VERSIÓN ${v}` };
    current = { ...step(current), schemaVersion: v + 1 };
  }

  const result = validateProject(current);
  if (!result.ok) return { ok: false, error: `PROYECTO DAÑADO · ${result.error}` };
  return { ok: true, project: result.value, readOnly: false, migratedFrom: version < currentVersion ? version : null };
}
