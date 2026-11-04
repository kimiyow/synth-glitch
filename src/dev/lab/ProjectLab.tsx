import { ImageFormat } from "@shopify/react-native-skia";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { PREVIEW_LONG_SIDE, renderSceneJpeg, THUMB_LONG_SIDE } from "../../editor/renderPreviews";
import { EFFECTS } from "../../engine/registry";
import { createProject } from "../../project/schema";
import { createProjectFiles, newProjectId } from "../../project/storage";
import { projectFs } from "../../state/activeScene";
import type { Layer } from "../../state/types";
import { LabChip, labStyles } from "./labUi";
import { makeTestImage, TEST_IMAGE_SIZE } from "./testImage";

function randomLayers(): Layer[] {
  const count = 1 + Math.floor(Math.random() * 3);
  return Array.from({ length: count }, (_, i) => {
    const effect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
    return {
      kind: "effect",
      id: `l${i}`,
      effect: effect.id,
      params: { x: Math.round(Math.random() * 100) / 100, y: Math.round(Math.random() * 100) / 100 },
      visible: true,
    };
  });
}

/** M2: crea proyectos con la imagen de prueba mientras no existe la cámara (M3). */
async function createTestProject(): Promise<string> {
  const image = makeTestImage();
  if (!image) throw new Error("no se generó la imagen de prueba");
  const now = new Date();
  const base = createProject({
    id: newProjectId(now),
    media: { kind: "photo", file: "media.jpg", ...TEST_IMAGE_SIZE },
    seed: Math.floor(Math.random() * 1e6),
    now,
  });
  const project = { ...base, scene: { ...base.scene, layers: randomLayers() } };
  const media = image.encodeToBytes(ImageFormat.JPEG, 92);
  const preview = await renderSceneJpeg(image, project.scene, PREVIEW_LONG_SIDE);
  const thumb = await renderSceneJpeg(image, project.scene, THUMB_LONG_SIDE, 80);
  createProjectFiles(projectFs, project, { media: { name: "media.jpg", bytes: media }, preview, thumb });
  return `${project.name} · ${project.scene.layers.map((l) => (l.kind === "effect" ? l.effect : "")).join(" → ")}`;
}

export function ProjectLab() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const create = async (n: number) => {
    setBusy(true);
    for (let i = 0; i < n; i++) {
      try {
        const line = await createTestProject();
        setLog((l) => [`✓ ${line}`, ...l]);
      } catch (error) {
        setLog((l) => [`✗ ${error instanceof Error ? error.message : String(error)}`, ...l]);
      }
    }
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={labStyles.controls}>
      <View style={labStyles.row}>
        <LabChip label="CREAR PROYECTO DE PRUEBA" disabled={busy} onPress={() => create(1)} />
        <LabChip label="CREAR 5" disabled={busy} onPress={() => create(5)} />
      </View>
      <Text style={labStyles.label}>Luego ábrelos desde la pestaña GALERÍA.</Text>
      {log.map((line, i) => (
        <Text key={i} style={labStyles.data}>
          {line}
        </Text>
      ))}
    </ScrollView>
  );
}
