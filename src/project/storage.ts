import type { Project } from "../state/types";
import { loadProject, type LoadResult } from "./migrate";
import type { ProjectFs } from "./projectFs";

export const PROJECT_FILE = "project.json";
export const TEMP_FILE = "project.json.tmp";
export const PREVIEW_FILE = "preview.jpg"; // lado largo 2048 px
export const THUMB_FILE = "thumb.jpg"; // lado largo 400 px
export const MAX_NAME_LENGTH = 40;

/**
 * Escritura atómica (PRJ-06): se escribe el temporal completo y luego se mueve
 * sobre `project.json`. Aunque el `move` no fuera atómico, `readProject`
 * recupera desde el temporal, así que un corte deja la versión vieja o la nueva.
 */
export function saveProject(fs: ProjectFs, project: Project): void {
  fs.createDir(project.id);
  fs.remove(project.id, TEMP_FILE);
  fs.writeText(project.id, TEMP_FILE, JSON.stringify(project));
  fs.move(project.id, TEMP_FILE, PROJECT_FILE);
}

/** Lee y migra un proyecto. Un temporal válido es siempre la escritura más reciente. */
export function readProject(fs: ProjectFs, id: string): LoadResult {
  const fromTemp = tryLoad(fs, id, TEMP_FILE);
  if (fromTemp?.ok) {
    // Termina la escritura interrumpida.
    try {
      fs.move(id, TEMP_FILE, PROJECT_FILE);
    } catch {
      // Se reintentará en la próxima lectura o guardado.
    }
    return fromTemp;
  }
  return tryLoad(fs, id, PROJECT_FILE) ?? { ok: false, error: "NO SE ENCONTRÓ EL PROYECTO" };
}

function tryLoad(fs: ProjectFs, id: string, name: string): LoadResult | null {
  if (!fs.exists(id, name)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readText(id, name));
  } catch {
    return { ok: false, error: "PROYECTO DAÑADO · JSON INVÁLIDO" };
  }
  return loadProject(raw);
}

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  mediaKind: Project["scene"]["media"]["kind"] | null;
  thumbUri: string | null;
  readOnly: boolean;
  error: string | null;
};

/** Galería: se lee cada carpeta; no hay un índice aparte (3.7). Más reciente primero. */
export function listProjects(fs: ProjectFs): ProjectSummary[] {
  const summaries = fs.listIds().map((id): ProjectSummary => {
    const thumbUri = fs.exists(id, THUMB_FILE) ? fs.uri(id, THUMB_FILE) : null;
    const result = readProject(fs, id);
    if (!result.ok) {
      return { id, name: id, updatedAt: "", mediaKind: null, thumbUri, readOnly: true, error: result.error };
    }
    const { project } = result;
    return {
      id,
      name: project.name,
      updatedAt: project.updatedAt,
      mediaKind: project.scene.media.kind,
      thumbUri,
      readOnly: result.readOnly,
      error: null,
    };
  });
  return summaries.sort((a, b) => (a.error ? 1 : 0) - (b.error ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt));
}

export type FilesToWrite = {
  media?: { name: string; bytes: Uint8Array } | { name: string; sourceUri: string };
  preview?: Uint8Array;
  thumb?: Uint8Array;
};

/** Crea la carpeta de un proyecto nuevo con su medio, imágenes y `project.json`. */
export function createProjectFiles(fs: ProjectFs, project: Project, files: FilesToWrite): void {
  fs.createDir(project.id);
  try {
    const { media } = files;
    if (media && "bytes" in media) fs.writeBytes(project.id, media.name, media.bytes);
    if (media && "sourceUri" in media) fs.copyFileIn(project.id, media.name, media.sourceUri);
    writeImages(fs, project.id, files);
    saveProject(fs, project);
  } catch (error) {
    fs.removeDir(project.id);
    throw error;
  }
}

export function writeImages(fs: ProjectFs, id: string, files: Pick<FilesToWrite, "preview" | "thumb">): void {
  if (files.preview) fs.writeBytes(id, PREVIEW_FILE, files.preview);
  if (files.thumb) fs.writeBytes(id, THUMB_FILE, files.thumb);
}

export function normalizeName(name: string): string | null {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return clean.length > 0 ? clean : null;
}

type OpResult = { ok: true; project: Project } | { ok: false; error: string };

function loadEditable(fs: ProjectFs, id: string): OpResult {
  const result = readProject(fs, id);
  if (!result.ok) return result;
  if (result.readOnly) return { ok: false, error: "PROYECTO DE SOLO LECTURA" };
  return { ok: true, project: result.project };
}

export function renameProject(fs: ProjectFs, id: string, name: string, now: Date): OpResult {
  const clean = normalizeName(name);
  if (!clean) return { ok: false, error: "EL NOMBRE NO PUEDE ESTAR VACÍO" };
  const loaded = loadEditable(fs, id);
  if (!loaded.ok) return loaded;
  const project = { ...loaded.project, name: clean, updatedAt: now.toISOString() };
  saveProject(fs, project);
  return { ok: true, project };
}

/** Copia la carpeta completa (medio e imágenes) con id nuevo y nombre "<nombre> COPIA". */
export function duplicateProject(fs: ProjectFs, id: string, newId: string, now: Date): OpResult {
  const loaded = readProject(fs, id);
  if (!loaded.ok) return loaded;
  fs.copyDir(id, newId);
  fs.remove(newId, TEMP_FILE);
  const iso = now.toISOString();
  const project: Project = {
    ...loaded.project,
    id: newId,
    name: normalizeName(`${loaded.project.name} COPIA`) ?? loaded.project.name,
    createdAt: iso,
    updatedAt: iso,
  };
  saveProject(fs, project);
  return { ok: true, project };
}

export function deleteProject(fs: ProjectFs, id: string): void {
  fs.removeDir(id);
}

/** Id corto, ordenable por fecha y sin colisiones prácticas. */
export function newProjectId(now: Date, random: () => number = Math.random): string {
  return `${now.getTime().toString(36)}-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, "0")}`;
}
