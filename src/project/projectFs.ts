/**
 * Operaciones de archivos que necesita la capa de proyectos. Cada proyecto es una
 * carpeta `projects/<id>/`; los nombres son relativos a esa carpeta.
 * Existe para poder probar la lógica (incluidos cortes a mitad de escritura) sin el dispositivo.
 */
export interface ProjectFs {
  listIds(): string[];
  createDir(id: string): void;
  removeDir(id: string): void;
  copyDir(fromId: string, toId: string): void;
  exists(id: string, name: string): boolean;
  readText(id: string, name: string): string;
  writeText(id: string, name: string, text: string): void;
  writeBytes(id: string, name: string, bytes: Uint8Array): void;
  /** Copia un archivo externo (p. ej. la captura de la cámara) dentro del proyecto. */
  copyFileIn(id: string, name: string, sourceUri: string): void;
  /** Mueve sobrescribiendo el destino si existe (no se asume que sea atómico). */
  move(id: string, from: string, to: string): void;
  remove(id: string, name: string): void;
  uri(id: string, name: string): string;
}
