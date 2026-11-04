import { describe, expect, it } from "@jest/globals";

import type { Project } from "../state/types";
import type { ProjectFs } from "./projectFs";
import { createProject, SCHEMA_VERSION } from "./schema";
import {
  createProjectFiles,
  deleteProject,
  duplicateProject,
  listProjects,
  newProjectId,
  PROJECT_FILE,
  readProject,
  renameProject,
  saveProject,
  TEMP_FILE,
  THUMB_FILE,
} from "./storage";

class Crash extends Error {}

/** Sistema de archivos en memoria. `move` es NO atómico (borra y luego renombra). */
class MemoryFs implements ProjectFs {
  dirs = new Map<string, Map<string, string | Uint8Array>>();
  /** Si es un número, la operación con ese índice lanza Crash. */
  crashAt: number | null = null;
  ops = 0;

  private step() {
    if (this.crashAt !== null && this.ops++ === this.crashAt) throw new Crash();
  }
  private dir(id: string) {
    const d = this.dirs.get(id);
    if (!d) throw new Error(`no existe ${id}`);
    return d;
  }
  listIds = () => [...this.dirs.keys()];
  createDir = (id: string) => {
    if (!this.dirs.has(id)) this.dirs.set(id, new Map());
  };
  removeDir = (id: string) => void this.dirs.delete(id);
  copyDir = (from: string, to: string) => void this.dirs.set(to, new Map(this.dir(from)));
  exists = (id: string, name: string) => this.dirs.get(id)?.has(name) ?? false;
  readText = (id: string, name: string) => String(this.dir(id).get(name));
  writeText = (id: string, name: string, text: string) => {
    this.step();
    // Una escritura cortada deja el archivo a medias.
    this.dir(id).set(name, text.slice(0, Math.floor(text.length / 2)));
    this.step();
    this.dir(id).set(name, text);
  };
  writeBytes = (id: string, name: string, bytes: Uint8Array) => void this.dir(id).set(name, bytes);
  move = (id: string, from: string, to: string) => {
    const d = this.dir(id);
    const content = d.get(from);
    if (content === undefined) throw new Error("no existe el origen");
    this.step();
    d.delete(to);
    this.step();
    d.set(to, content);
    d.delete(from);
  };
  remove = (id: string, name: string) => {
    this.step();
    this.dirs.get(id)?.delete(name);
  };
  uri = (id: string, name: string) => `mem://${id}/${name}`;
}

const T0 = new Date(2026, 10, 3, 10, 0);
const T1 = new Date(2026, 10, 3, 11, 0);

function project(id = "p1", name?: string): Project {
  const p = createProject({ id, media: { kind: "photo", file: "media.jpg", width: 100, height: 80 }, seed: 5, now: T0 });
  return name ? { ...p, name } : p;
}

describe("guardar y leer", () => {
  it("lee exactamente lo que guardó (PRJ-04)", () => {
    const fs = new MemoryFs();
    const p = project();
    p.scene.layers = [{ kind: "effect", id: "a", effect: "crt", params: { x: 0.2, y: 0.9 }, visible: true }];
    saveProject(fs, p);
    expect(readProject(fs, "p1")).toEqual({ ok: true, project: p, readOnly: false, migratedFrom: null });
    expect(fs.exists("p1", TEMP_FILE)).toBe(false);
  });

  it("no existe → error", () => {
    expect(readProject(new MemoryFs(), "nada").ok).toBe(false);
  });

  it("un corte en cualquier paso deja la versión vieja o la nueva (PRJ-06)", () => {
    const oldP = project("p1", "VIEJO");
    const newP = { ...project("p1", "NUEVO"), updatedAt: T1.toISOString() };
    let crashes = 0;
    for (let k = 0; ; k++) {
      const fs = new MemoryFs();
      saveProject(fs, oldP);
      fs.crashAt = k;
      fs.ops = 0;
      let crashed = false;
      try {
        saveProject(fs, newP);
      } catch (e) {
        if (!(e instanceof Crash)) throw e;
        crashed = true;
      }
      fs.crashAt = null;
      const result = readProject(fs, "p1");
      expect(result.ok).toBe(true);
      if (result.ok) expect(["VIEJO", "NUEVO"]).toContain(result.project.name);
      if (!crashed) {
        if (result.ok) expect(result.project.name).toBe("NUEVO");
        break;
      }
      crashes++;
    }
    expect(crashes).toBeGreaterThan(3);
  });

  it("si project.json está dañado pero el temporal es válido, recupera y repara", () => {
    const fs = new MemoryFs();
    saveProject(fs, project());
    fs.dirs.get("p1")!.set(TEMP_FILE, JSON.stringify(project("p1", "RECUPERADO")));
    fs.dirs.get("p1")!.set(PROJECT_FILE, "{roto");
    const result = readProject(fs, "p1");
    expect(result.ok && result.project.name).toBe("RECUPERADO");
    expect(fs.exists("p1", TEMP_FILE)).toBe(false);
  });

  it("ignora un temporal a medias", () => {
    const fs = new MemoryFs();
    saveProject(fs, project("p1", "BUENO"));
    fs.dirs.get("p1")!.set(TEMP_FILE, '{"schemaVersion":1,"id":');
    const result = readProject(fs, "p1");
    expect(result.ok && result.project.name).toBe("BUENO");
  });
});

describe("galería", () => {
  it("lista leyendo cada carpeta, más reciente primero y dañados al final", () => {
    const fs = new MemoryFs();
    saveProject(fs, project("a", "A"));
    saveProject(fs, { ...project("b", "B"), updatedAt: T1.toISOString() });
    fs.createDir("roto");
    fs.dirs.get("roto")!.set(PROJECT_FILE, "no json");
    fs.writeBytes("b", THUMB_FILE, new Uint8Array([1]));
    const list = listProjects(fs);
    expect(list.map((s) => s.id)).toEqual(["b", "a", "roto"]);
    expect(list[0].thumbUri).toBe("mem://b/thumb.jpg");
    expect(list[1].thumbUri).toBeNull();
    expect(list[2].error).toMatch(/DAÑADO/);
  });

  it("marca en solo lectura los proyectos de una versión futura", () => {
    const fs = new MemoryFs();
    saveProject(fs, { ...project("f"), schemaVersion: SCHEMA_VERSION + 1 });
    expect(listProjects(fs)[0]).toMatchObject({ id: "f", readOnly: true, error: null });
  });
});

describe("operaciones (PRJ-03)", () => {
  it("crea la carpeta con medio, miniatura y proyecto", () => {
    const fs = new MemoryFs();
    createProjectFiles(fs, project(), {
      media: { name: "media.jpg", bytes: new Uint8Array([1, 2]) },
      thumb: new Uint8Array([3]),
      preview: new Uint8Array([4]),
    });
    expect([...fs.dirs.get("p1")!.keys()].sort()).toEqual(["media.jpg", "preview.jpg", "project.json", "thumb.jpg"]);
  });

  it("si la creación falla no deja una carpeta a medias", () => {
    const fs = new MemoryFs();
    fs.crashAt = 0;
    expect(() => createProjectFiles(fs, project(), {})).toThrow(Crash);
    expect(fs.dirs.has("p1")).toBe(false);
  });

  it("renombra limpiando espacios y actualiza la fecha", () => {
    const fs = new MemoryFs();
    saveProject(fs, project());
    const result = renameProject(fs, "p1", "  mi   glitch  ", T1);
    expect(result.ok && result.project.name).toBe("mi glitch");
    const reread = readProject(fs, "p1");
    expect(reread.ok && reread.project.updatedAt).toBe(T1.toISOString());
  });

  it("no acepta un nombre vacío", () => {
    const fs = new MemoryFs();
    saveProject(fs, project());
    expect(renameProject(fs, "p1", "   ", T1)).toEqual({ ok: false, error: "EL NOMBRE NO PUEDE ESTAR VACÍO" });
  });

  it("no renombra un proyecto de solo lectura", () => {
    const fs = new MemoryFs();
    saveProject(fs, { ...project(), schemaVersion: SCHEMA_VERSION + 1 });
    expect(renameProject(fs, "p1", "X", T1).ok).toBe(false);
  });

  it("duplica con id y fechas nuevas y nombre COPIA, conservando los archivos", () => {
    const fs = new MemoryFs();
    saveProject(fs, project("p1", "ORIGINAL"));
    fs.writeBytes("p1", "media.jpg", new Uint8Array([9]));
    const result = duplicateProject(fs, "p1", "p2", T1);
    expect(result.ok && result.project).toMatchObject({ id: "p2", name: "ORIGINAL COPIA", createdAt: T1.toISOString() });
    expect(fs.exists("p2", "media.jpg")).toBe(true);
    const original = readProject(fs, "p1");
    expect(original.ok && original.project.name).toBe("ORIGINAL");
  });

  it("elimina la carpeta completa", () => {
    const fs = new MemoryFs();
    saveProject(fs, project());
    deleteProject(fs, "p1");
    expect(listProjects(fs)).toEqual([]);
  });

  it("genera ids distintos y ordenables por fecha", () => {
    const a = newProjectId(T0, () => 0.1);
    const b = newProjectId(T1, () => 0.1);
    expect(a).not.toBe(newProjectId(T0, () => 0.2));
    expect(a < b).toBe(true);
  });
});
