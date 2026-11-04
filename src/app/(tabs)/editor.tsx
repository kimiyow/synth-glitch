import { Canvas, useImage } from "@shopify/react-native-skia";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DEV_TOOLS_ENABLED } from "../../dev/devTools";
import { croppedSize } from "../../engine/crop";
import { SceneRenderer } from "../../editor/SceneRenderer";
import { EFFECTS } from "../../engine/registry";
import type { SaveStatus } from "../../project/autosave";
import { PREVIEW_FILE } from "../../project/storage";
import { projectFs, sceneStore, useScene } from "../../state/activeScene";
import type { Project, Scene } from "../../state/types";
import { pickMediaFromLibrary } from "../../platform/pickMedia";
import { createProjectFromClip, createProjectFromPhoto } from "../../state/captureActions";
import { EditorEmpty } from "../../ui/editor/EditorEmpty";
import { colors, geometry, type } from "../../ui/tokens";

/**
 * Editor provisional de M2: muestra el proyecto activo y su estado de guardado.
 * El editor real (lienzo, gestos, paneles) llega en M4.
 */
export default function EditorScreen() {
  const project = useScene((s) => s.project);
  if (!project) return <EmptyEditor />;
  return <ProjectView project={project} />;
}

/** CAM-05: importar foto o video; las importaciones no se recortan (aspecto libre). */
function EmptyEditor() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const importMedia = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const picked = await pickMediaFromLibrary();
      if (picked.kind === "rejected") setMessage(picked.message);
      if (picked.kind === "selected") {
        const { uri, type: kind } = picked.media;
        const result = kind === "clip" ? await createProjectFromClip(uri, "free") : await createProjectFromPhoto(uri, "free");
        if (!result.ok) setMessage(`ERROR · ${result.error}`);
      }
    } catch (error) {
      setMessage(`ERROR · ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <EditorEmpty
      busy={busy}
      message={message}
      onImport={importMedia}
      onCamera={() => router.navigate("/")}
      onDismissMessage={() => setMessage(null)}
    />
  );
}

function ProjectView({ project }: { project: Project }) {
  const { width } = useWindowDimensions();
  const readOnly = useScene((s) => s.readOnly);
  const saveStatus = useScene((s) => s.saveStatus);
  const { media } = project.scene;
  // Los clips muestran su primer cuadro (preview.jpg, ya recortado) hasta M10 (SP-05).
  const isClip = media.kind === "clip";
  const imageFile = isClip ? PREVIEW_FILE : media.file;
  const image = useImage(imageFile ? projectFs.uri(project.id, imageFile) : null);
  const cropped = croppedSize(media.width, media.height, project.scene.crop.rect);
  const height = Math.round((width * cropped.height) / cropped.width);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar proyecto"
            onPress={() => sceneStore.getState().close()}
            hitSlop={10}
          >
            <Text style={styles.title}>‹</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {project.name}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <SaveIndicator status={saveStatus} readOnly={readOnly} updatedAt={project.updatedAt} />
        </View>
        {image ? (
          <Canvas style={{ width, height }}>
            <SceneRenderer
              image={image}
              width={width}
              height={height}
              layers={isClip ? [] : project.scene.layers}
              seed={project.scene.seed}
              frame={{ time: 0, params: [] }}
              crop={isClip ? undefined : project.scene.crop.rect}
            />
          </Canvas>
        ) : (
          <View style={[styles.noImage, { width, height: Math.min(height, width) }]}>
            <Text style={styles.label}>{media.file ? "CARGANDO…" : "SIN IMAGEN"}</Text>
          </View>
        )}
        <View style={styles.footer}>
          <Text style={styles.label}>
            {isClip ? "CLIP · VISTA DEL PRIMER CUADRO · " : ""}
            {project.scene.layers.length} CAPAS · SEMILLA {project.scene.seed} · PENDIENTE M4
          </Text>
          {DEV_TOOLS_ENABLED && !readOnly && (
            <Pressable accessibilityRole="button" onPress={testChange} style={styles.button}>
              <Text style={styles.label}>CAMBIO DE PRUEBA</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SaveIndicator({ status, readOnly, updatedAt }: { status: SaveStatus; readOnly: boolean; updatedAt: string }) {
  if (readOnly) return <Text style={styles.label}>SOLO LECTURA</Text>;
  if (status.state === "error") {
    return (
      <Pressable accessibilityRole="button" onPress={() => sceneStore.getState().flush()}>
        <Text style={styles.error}>ERROR AL GUARDAR · REINTENTAR</Text>
      </Pressable>
    );
  }
  if (status.state === "saved") {
    return <Text style={styles.label}>GUARDADO · {new Date(updatedAt).toLocaleTimeString("es-MX")}</Text>;
  }
  return <Text style={styles.saving}>Guardando cambios…</Text>;
}

/** Solo desarrollo: cambia el efecto de la última capa (o añade una) para probar el autoguardado. */
function testChange() {
  sceneStore.getState().commit((scene): Scene => {
    const effect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
    const layer = {
      kind: "effect" as const,
      id: `test-${Date.now()}`,
      effect: effect.id,
      params: { ...effect.defaults },
      visible: true,
    };
    const layers = scene.layers.length >= 3 ? [...scene.layers.slice(0, -1), layer] : [...scene.layers, layer];
    return { ...scene, layers };
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: geometry.compactMargin,
    minHeight: geometry.target,
  },
  title: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.title },
  statusRow: { paddingHorizontal: geometry.compactMargin, paddingBottom: 8 },
  saving: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  error: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  noImage: { alignItems: "center", justifyContent: "center", backgroundColor: colors.inkSurface },
  footer: { padding: geometry.compactMargin, gap: 12 },
  button: {
    minHeight: geometry.target,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: geometry.hairline,
  },
});
