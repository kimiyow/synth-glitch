import { useImage } from "@shopify/react-native-skia";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DEV_TOOLS_ENABLED } from "../../dev/devTools";
import { EditorCanvas } from "../../editor/EditorCanvas";
import { popOverlay, toggleOverlay, type OverlayStack, type PanelId, type ToolButtonId } from "../../editor/panels";
import { croppedSize } from "../../engine/crop";
import { EFFECTS } from "../../engine/registry";
import { pickMediaFromLibrary } from "../../platform/pickMedia";
import { PREVIEW_FILE } from "../../project/storage";
import { projectFs, sceneStore, useScene } from "../../state/activeScene";
import { createProjectFromClip, createProjectFromPhoto } from "../../state/captureActions";
import type { Project } from "../../state/types";
import { EditorEmpty } from "../../ui/editor/EditorEmpty";
import { EditorToolbar } from "../../ui/editor/EditorToolbar";
import { EditorTopBar } from "../../ui/editor/EditorTopBar";
import { ExportPanel } from "../../ui/editor/ExportPanel";
import { PanelSheet } from "../../ui/editor/PanelSheet";
import { colors, geometry, type } from "../../ui/tokens";

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

const PANEL_TITLES: Record<PanelId, string> = {
  brush: "Pincel · M6",
  effects: "Efectos · M5",
  presets: "Presets · M7",
  gesture: "Gesto · M7",
  export: "Exportar",
};

function ProjectView({ project }: { project: Project }) {
  const readOnly = useScene((s) => s.readOnly);
  const saveStatus = useScene((s) => s.saveStatus);
  const canUndo = useScene((s) => s.history.past.length > 0);
  const canRedo = useScene((s) => s.history.future.length > 0);
  const { media } = project.scene;
  // Los clips muestran su primer cuadro (preview.jpg, ya recortado) hasta M10 (SP-05).
  const isClip = media.kind === "clip";
  const imageFile = isClip ? PREVIEW_FILE : media.file;
  const image = useImage(imageFile ? projectFs.uri(project.id, imageFile) : null);
  const content =
    isClip && image
      ? { width: image.width(), height: image.height() }
      : croppedSize(media.width, media.height, project.scene.crop.rect);

  // EDT-01: PINCEL activo al abrir (en clips no aplica, BRU-09).
  const [activeTool, setActiveTool] = useState<"brush" | "effects">(isClip ? "effects" : "brush");
  const [overlays, setOverlays] = useState<OverlayStack>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const openPanel = (overlays.at(-1) ?? null) as PanelId | null;

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2000);
    return () => clearTimeout(id);
  }, [notice]);

  const onToolPress = (id: ToolButtonId) => {
    if (id === "gyro") return setNotice("GIRO · LLEGA EN M7");
    if (id === "brush" && isClip) return setNotice("PINCEL · SOLO FOTOS");
    if (id === "brush" || id === "effects") setActiveTool(id);
    setOverlays((stack) => toggleOverlay(stack, id));
  };
  const closeTop = () => setOverlays((stack) => popOverlay(stack));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <EditorTopBar
        canUndo={canUndo && !readOnly}
        canRedo={canRedo && !readOnly}
        saving={saveStatus.state === "pending" || saveStatus.state === "saving"}
        exportOpen={openPanel === "export"}
        onBack={() => sceneStore.getState().close()}
        onUndo={() => sceneStore.getState().undo()}
        onRedo={() => sceneStore.getState().redo()}
        onExport={() => setOverlays((stack) => toggleOverlay(stack, "export"))}
      />
      <View style={styles.canvasArea}>
        {image ? (
          <EditorCanvas
            image={image}
            contentWidth={content.width}
            contentHeight={content.height}
            layers={isClip ? [] : project.scene.layers}
            seed={project.scene.seed}
            crop={isClip ? undefined : project.scene.crop.rect}
            onTap={closeTop}
          />
        ) : (
          <View style={styles.noImage}>
            <Text style={styles.label}>{media.file ? "CARGANDO…" : "SIN IMAGEN"}</Text>
          </View>
        )}
        {notice && <Text style={styles.notice}>{notice}</Text>}
      </View>

      {openPanel && (
        <PanelSheet onClose={closeTop}>
          {openPanel === "export" ? (
            <ExportPanel
              name={project.name}
              readOnly={readOnly}
              status={saveStatus}
              onRename={(name) => sceneStore.getState().rename(name)}
              onSaveProject={() => sceneStore.getState().flush()}
            />
          ) : (
            <PendingPanel title={PANEL_TITLES[openPanel]} showTestChange={openPanel === "presets" && !readOnly} />
          )}
        </PanelSheet>
      )}

      <EditorToolbar
        activeTool={activeTool}
        openPanel={openPanel}
        disabled={{ brush: isClip, gyro: true }}
        onPress={onToolPress}
      />
    </SafeAreaView>
  );
}

function PendingPanel({ title, showTestChange }: { title: string; showTestChange: boolean }) {
  return (
    <View style={styles.pending}>
      <Text style={styles.panelTitle}>{title}</Text>
      {DEV_TOOLS_ENABLED && showTestChange && (
        <Pressable accessibilityRole="button" onPress={testChange} style={styles.button}>
          <Text style={styles.label}>CAMBIO DE PRUEBA</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Solo desarrollo: cambia el efecto de la última capa (o añade una) para probar autoguardado y deshacer. */
function testChange() {
  sceneStore.getState().commit("cambio de prueba", (scene) => {
    const effect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
    if (scene.layers.length >= 3) scene.layers.pop();
    scene.layers.push({
      kind: "effect",
      id: `test-${Date.now()}`,
      effect: effect.id,
      params: { ...effect.defaults },
      visible: true,
    });
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  canvasArea: { flex: 1, marginHorizontal: 18, marginBottom: 8 },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.inkSurface, borderRadius: 12 },
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  notice: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    color: colors.paperText,
    backgroundColor: colors.paper,
    fontFamily: type.family,
    fontSize: type.label,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pending: { minHeight: 80, gap: 12 },
  panelTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.body },
  button: {
    minHeight: geometry.target,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: geometry.hairline,
  },
});
