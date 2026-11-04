import { useState } from "react";
import { ScrollView, Text } from "react-native";

import { createExpoProjectFs } from "../../project/expoProjectFs";
import { createProject } from "../../project/schema";
import {
  listProjects,
  PROJECT_FILE,
  readProject,
  saveProject,
  TEMP_FILE,
} from "../../project/storage";
import type { Project, Stroke } from "../../state/types";
import { LabChip, labStyles } from "../lab/labUi";

type Line = { ok: boolean; text: string };

const STROKES = 400;
const STAMPS_PER_STROKE = 30;
const RUNS = 10;

/** Proyecto sintético con 400 trazos (el máximo) para medir NFR-08. */
function heavyProject(id: string): Project {
  const p = createProject({ id, media: { kind: "photo", file: "media.jpg", width: 4032, height: 3024 }, seed: 1, now: new Date() });
  const strokes: Stroke[] = Array.from({ length: STROKES }, (_, s) => ({
    id: `s${s}`,
    strokeSeed: s * 7919,
    stamps: Array.from({ length: STAMPS_PER_STROKE }, (_, i) => ({
      x: (i * 0.0317) % 1,
      y: (s * 0.0071) % 1,
      size: 0.05,
      effect: "datamosh" as const,
      erase: false,
      params: [6, 0.35],
      seed: s * 1000 + i,
    })),
  }));
  return { ...p, scene: { ...p.scene, paint: { strokes } } };
}

/**
 * SP-11: escritura atómica con renombrado en el sistema de archivos real,
 * recuperación tras un corte simulado y tiempo de guardado con 400 trazos (≤ 150 ms).
 */
export function Sp11Storage() {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    // Deja pintar el estado "EJECUTANDO…" antes del trabajo síncrono.
    setTimeout(() => {
      setLines(runChecks());
      setRunning(false);
    }, 50);
  };

  return (
    <ScrollView contentContainerStyle={labStyles.controls}>
      <LabChip label={running ? "EJECUTANDO…" : "EJECUTAR"} disabled={running} onPress={run} />
      {lines?.map((l, i) => (
        <Text key={i} style={labStyles.data}>
          {l.ok ? "✓" : "✗"} {l.text}
        </Text>
      ))}
      <Text style={labStyles.label}>
        Usa la carpeta lab-projects/ y la borra al terminar; no toca tus proyectos.
      </Text>
    </ScrollView>
  );
}

function runChecks(): Line[] {
  const lines: Line[] = [];
  const check = (name: string, fn: () => string) => {
    try {
      lines.push({ ok: true, text: `${name} · ${fn()}` });
    } catch (error) {
      lines.push({ ok: false, text: `${name} · ${error instanceof Error ? error.message : String(error)}` });
    }
  };
  const fs = createExpoProjectFs("lab-projects");
  const cleanup = () => fs.listIds().forEach((id) => fs.removeDir(id));
  cleanup();

  check("guardar y leer idéntico", () => {
    const p = createProject({ id: "a", media: { kind: "generative", width: 1080, height: 1920 }, seed: 3, now: new Date() });
    saveProject(fs, p);
    const r = readProject(fs, "a");
    if (!r.ok) throw new Error(r.error);
    if (JSON.stringify(r.project) !== JSON.stringify(p)) throw new Error("el contenido no coincide");
    if (fs.exists("a", TEMP_FILE)) throw new Error("quedó el temporal");
    return "ok";
  });

  check("move sobrescribe el destino", () => {
    const p = createProject({ id: "a", media: { kind: "generative", width: 1080, height: 1920 }, seed: 3, now: new Date() });
    saveProject(fs, { ...p, name: "SEGUNDO" });
    const r = readProject(fs, "a");
    if (!r.ok || r.project.name !== "SEGUNDO") throw new Error("no se sobrescribió");
    return "ok";
  });

  check("recupera tras un corte (temporal sin mover)", () => {
    const p = createProject({ id: "b", media: { kind: "generative", width: 1080, height: 1920 }, seed: 3, now: new Date() });
    saveProject(fs, { ...p, name: "VIEJO" });
    fs.writeText("b", TEMP_FILE, JSON.stringify({ ...p, name: "NUEVO" }));
    fs.remove("b", PROJECT_FILE); // corte justo entre borrar y renombrar
    const r = readProject(fs, "b");
    if (!r.ok || r.project.name !== "NUEVO") throw new Error("no recuperó");
    if (!fs.exists("b", PROJECT_FILE) || fs.exists("b", TEMP_FILE)) throw new Error("no reparó los archivos");
    return "ok";
  });

  check("ignora un temporal a medias", () => {
    fs.writeText("b", TEMP_FILE, '{"schemaVersion":1,"id":');
    const r = readProject(fs, "b");
    if (!r.ok || r.project.name !== "NUEVO") throw new Error("no leyó el bueno");
    return "ok";
  });

  check(`guardar 400 trazos (×${RUNS})`, () => {
    const p = heavyProject("heavy");
    const json = JSON.stringify(p);
    const times: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      saveProject(fs, p);
      times.push(performance.now() - t0);
    }
    const t0 = performance.now();
    const r = readProject(fs, "heavy");
    const readMs = performance.now() - t0;
    if (!r.ok) throw new Error(r.error);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const text = `${(json.length / 1024).toFixed(0)} KB · prom ${avg.toFixed(0)} ms · máx ${max.toFixed(0)} ms · leer ${readMs.toFixed(0)} ms`;
    if (max > 150) throw new Error(`${text} · SUPERA 150 ms`);
    return text;
  });

  check("galería lee cada carpeta", () => `${listProjects(fs).length} proyectos`);

  cleanup();
  check("limpieza", () => `${fs.listIds().length} carpetas restantes`);
  return lines;
}
