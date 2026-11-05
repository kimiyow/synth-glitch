import { ImageFormat, Skia, type SkImage } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { exportLongSide, renderSceneJpeg, sceneFrameAt } from "../../editor/renderPreviews";
import { EFFECTS, GENERATORS } from "../../engine/registry";
import { STAMP_DEFAULTS, stampSeed } from "../../paint/strokeInterpolate";
import { createProject } from "../../project/schema";
import { createProjectFiles, newProjectId } from "../../project/storage";
import { projectFs, sceneStore } from "../../state/activeScene";
import type { Layer, Stamp, StampEffect } from "../../state/types";
import { LabChip, labStyles } from "./labUi";
import { makeTestImage } from "./testImage";

/** 12 MP, como una foto de la cámara del iPhone. */
const BIG = { width: 4032, height: 3024 };
export const ENDURANCE_CYCLES = 50;

/** Imagen grande nueva en cada ciclo (la de prueba ampliada), para estresar la memoria. */
function makeBigImage(): SkImage {
  const small = makeTestImage();
  const surface = Skia.Surface.MakeOffscreen(BIG.width, BIG.height);
  if (!small || !surface) throw new Error("NO SE PUDO CREAR LA IMAGEN DE 12 MP");
  surface.getCanvas().drawImageRect(
    small,
    Skia.XYWHRect(0, 0, small.width(), small.height()),
    Skia.XYWHRect(0, 0, BIG.width, BIG.height),
    Skia.Paint(),
  );
  surface.flush();
  const image = surface.makeImageSnapshot().makeNonTextureImage();
  surface.dispose();
  if (!image) throw new Error("NO SE PUDO COPIAR LA IMAGEN DE 12 MP");
  return image;
}

function randomLayers(): Layer[] {
  const fx = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
  const gen = GENERATORS[Math.floor(Math.random() * GENERATORS.length)];
  return [
    { kind: "effect", id: "fx", effect: fx.id, params: { ...fx.defaults }, visible: true },
    { kind: "generator", id: "gen", generator: gen.id, params: { ...gen.defaults }, visible: true, blend: "screen" },
  ];
}

function randomStroke(seed: number): Stamp[] {
  const effects: StampEffect[] = ["datamosh", "chromatic", "pixel", "smear"];
  return Array.from({ length: 40 }, (_, i) => {
    const effect = effects[i % effects.length];
    return { x: 0.1 + (i / 40) * 0.8, y: 0.4, size: 0.06, effect, erase: false, params: STAMP_DEFAULTS[effect], seed: stampSeed(seed, 0, i) };
  });
}

/** Memoria del motor de JS (Hermes), si la expone; la memoria nativa no se puede leer desde Expo Go. */
function jsHeapMb(): number | null {
  const hermes = (globalThis as { HermesInternal?: { getInstrumentedStats?: () => Record<string, number> } }).HermesInternal;
  const stats = hermes?.getInstrumentedStats?.();
  const bytes = stats?.js_heapSize ?? stats?.js_allocatedBytes;
  return typeof bytes === "number" ? bytes / 1024 / 1024 : null;
}

/** Un ciclo captura → editar → exportar (NFR-10). Devuelve los ms que tardó. */
async function runCycle(i: number): Promise<number> {
  const start = Date.now();
  const image = makeBigImage();
  const now = new Date();
  const seed = 1000 + i;
  const base = createProject({ id: newProjectId(now), media: { kind: "photo", file: "media.jpg", ...BIG }, seed, now });
  const project = {
    ...base,
    scene: { ...base.scene, layers: randomLayers(), paint: { strokes: [{ id: `s${i}`, strokeSeed: seed, stamps: randomStroke(seed) }] } },
  };
  try {
    // Captura: se escribe el medio como borrador y se abre, como al tomar una foto.
    createProjectFiles(projectFs, project, { media: { name: "media.jpg", bytes: image.encodeToBytes(ImageFormat.JPEG, 92) } }, { draft: true });
    sceneStore.getState().open(project, false, { draft: true });
    // Editar: un cambio confirmado (entra al historial).
    sceneStore.getState().commit("resistencia", (scene) => {
      scene.layers[0].params = { x: Math.random(), y: Math.random() };
    });
    // Exportar: JPG a resolución completa a la caché (no a Fotos, para no llenar la fototeca).
    const scene = sceneStore.getState().project?.scene ?? project.scene;
    const bytes = await renderSceneJpeg(image, scene, exportLongSide(image, scene), 95, sceneFrameAt(scene, i * 0.1));
    const out = new File(Paths.cache, "resistencia.jpg");
    if (out.exists) out.delete();
    out.create();
    out.writeSync(bytes);
    out.delete();
  } finally {
    image.dispose();
    // Salir sin guardar: el borrador se borra.
    sceneStore.getState().close();
  }
  return Date.now() - start;
}

/** NFR-10 / CA-28: 50 ciclos de captura, edición y exportación sin cierres ni memoria creciente. */
export function EnduranceLab() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);

  const start = async () => {
    if (sceneStore.getState().project) {
      setLog(["Cierra el proyecto abierto en el editor antes de empezar (esta prueba abre y cierra proyectos)."]);
      return;
    }
    setBusy(true);
    stop.current = false;
    const heap0 = jsHeapMb();
    const times: number[] = [];
    setLog([`Inicio · memoria JS ${heap0?.toFixed(1) ?? "—"} MB`]);
    for (let i = 0; i < ENDURANCE_CYCLES && !stop.current; i++) {
      try {
        const ms = await runCycle(i);
        times.push(ms);
        const heap = jsHeapMb();
        setLog((l) => [`✓ ${i + 1}/${ENDURANCE_CYCLES} · ${ms} ms · memoria JS ${heap?.toFixed(1) ?? "—"} MB`, ...l]);
      } catch (error) {
        setLog((l) => [`✗ ${i + 1}: ${error instanceof Error ? error.message : String(error)}`, ...l]);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const heap1 = jsHeapMb();
    setLog((l) => [
      `FIN · ${times.length} ciclos · promedio ${avg} ms · memoria JS ${heap0?.toFixed(1) ?? "—"} → ${heap1?.toFixed(1) ?? "—"} MB`,
      ...l,
    ]);
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={labStyles.controls}>
      <View style={labStyles.row}>
        <LabChip label={`CORRER ${ENDURANCE_CYCLES} CICLOS`} disabled={busy} onPress={() => void start()} />
        <LabChip label="DETENER" disabled={!busy} onPress={() => (stop.current = true)} />
      </View>
      <Text style={labStyles.label}>
        Cada ciclo: foto de 12 MP → efecto + generador + trazo → JPG completo → salir sin guardar. Pasa si llega a 50 sin
        cerrarse y la memoria no crece de forma sostenida.
      </Text>
      {log.map((line, i) => (
        <Text key={i} style={labStyles.data}>
          {line}
        </Text>
      ))}
    </ScrollView>
  );
}
