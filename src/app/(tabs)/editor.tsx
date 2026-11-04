import { Canvas, useImage } from "@shopify/react-native-skia";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DEV_TOOLS_ENABLED } from "../../dev/devTools";
import { SceneRenderer } from "../../editor/SceneRenderer";
import { EFFECTS } from "../../engine/registry";
import type { SaveStatus } from "../../project/autosave";
import { projectFs, sceneStore, useScene } from "../../state/activeScene";
import type { Project, Scene } from "../../state/types";
import { ScreenPlaceholder } from "../../ui/ScreenPlaceholder";
import { colors, geometry, type } from "../../ui/tokens";

/**
 * Editor provisional de M2: muestra el proyecto activo y su estado de guardado.
 * El editor real (lienzo, gestos, paneles) llega en M4.
 */
export default function EditorScreen() {
  const project = useScene((s) => s.project);
  if (!project) {
    return <ScreenPlaceholder title="EDITOR" milestone="M4" note="ABRE UN PROYECTO DESDE LA GALERÍA" />;
  }
  return <ProjectView project={project} />;
}

function ProjectView({ project }: { project: Project }) {
  const { width } = useWindowDimensions();
  const readOnly = useScene((s) => s.readOnly);
  const saveStatus = useScene((s) => s.saveStatus);
  const { media } = project.scene;
  const image = useImage(media.file ? projectFs.uri(project.id, media.file) : null);
  const height = Math.round((width * media.height) / media.width);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {project.name}
          </Text>
          <SaveIndicator status={saveStatus} readOnly={readOnly} />
        </View>
        {image ? (
          <Canvas style={{ width, height }}>
            <SceneRenderer
              image={image}
              width={width}
              height={height}
              layers={project.scene.layers}
              seed={project.scene.seed}
              frame={{ time: 0, params: [] }}
            />
          </Canvas>
        ) : (
          <View style={[styles.noImage, { width, height: Math.min(height, width) }]}>
            <Text style={styles.label}>{media.file ? "CARGANDO…" : "SIN IMAGEN"}</Text>
          </View>
        )}
        <View style={styles.footer}>
          <Text style={styles.label}>
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

function SaveIndicator({ status, readOnly }: { status: SaveStatus; readOnly: boolean }) {
  if (readOnly) return <Text style={styles.label}>SOLO LECTURA</Text>;
  if (status.state === "error") {
    return (
      <Pressable accessibilityRole="button" onPress={() => sceneStore.getState().flush()}>
        <Text style={styles.error}>ERROR AL GUARDAR · REINTENTAR</Text>
      </Pressable>
    );
  }
  return <Text style={styles.label}>{status.state === "saved" ? "GUARDADO" : "Guardando cambios…"}</Text>;
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
