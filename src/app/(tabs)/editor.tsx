import { useImage } from "@shopify/react-native-skia";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DEV_TOOLS_ENABLED } from "../../dev/devTools";
import { EditorCanvas } from "../../editor/EditorCanvas";
import { EffectThumb } from "../../editor/EffectThumb";
import { MAX_STROKES, stampSeed, type BrushTool } from "../../paint/strokeInterpolate";
import { BrushPanel } from "../../ui/editor/BrushPanel";
import { toggleOverlay, type OverlayStack, type PanelId, type ToolButtonId } from "../../editor/panels";
import { croppedSize } from "../../engine/crop";
import { canAddLayer, isCostHigh, MAX_LAYERS } from "../../engine/layerCost";
import { EFFECT_BY_ID, EFFECTS, GENERATOR_BY_ID } from "../../engine/registry";
import { useSlowFrames } from "../../editor/useSlowFrames";
import { hasFastLuminanceRoute } from "../../modulation/safety";
import { pickMediaFromLibrary } from "../../platform/pickMedia";
import { PREVIEW_FILE } from "../../project/storage";
import { projectFs, sceneStore, useScene } from "../../state/activeScene";
import { createProjectFromClip, createProjectFromPhoto } from "../../state/captureActions";
import type { Layer, Project, SourceId } from "../../state/types";
import { EditorEmpty } from "../../ui/editor/EditorEmpty";
import { EditorToolbar } from "../../ui/editor/EditorToolbar";
import { EffectsPanel, THUMB_SIZE, type TileRef } from "../../ui/editor/EffectsPanel";
import { ModPanel } from "../../ui/editor/ModPanel";
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
  mod: "Mod",
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
  const layers = project.scene.layers;
  const [selectedId, setSelectedId] = useState<string | null>(() => layers.at(-1)?.id ?? null);
  const selected = layers.find((l) => l.id === selectedId) ?? null;
  const slowFrames = useSlowFrames();
  const strokes = project.scene.paint.strokes;
  const [brushTool, setBrushTool] = useState<BrushTool>("datamosh");
  const [brushSize, setBrushSize] = useState(0.35);
  const [brushSpacing, setBrushSpacing] = useState(0.25);
  const [sizePreview, setSizePreview] = useState(false);
  const showCostWarning = layers.length > 0 && (isCostHigh(layers) || slowFrames);
  const openPanel = (overlays.at(-1) ?? null) as PanelId | null;

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2000);
    return () => clearTimeout(id);
  }, [notice]);

  const onToolPress = (id: ToolButtonId) => {
    if (id === "gyro") return setNotice("GIRO · LLEGA EN M7");
    if (id === "brush" && isClip) return setNotice("PINCEL · SOLO FOTOS");
    if (id === "brush" && strokes.length >= MAX_STROKES) setNotice(`LÍMITE DE ${MAX_STROKES} TRAZOS`);
    if (id === "brush" || id === "effects") setActiveTool(id);
    setOverlays((stack) => toggleOverlay(stack, id));
  };

  // MOD-03: una ruta por eje desde el panel; DEDO quita la ruta.
  const setRouteSource = (layerId: string, axis: "x" | "y", source: SourceId) =>
    sceneStore.getState().commit("ruta de modulación", (scene) => {
      const prev = scene.routes.find((r) => r.target.layerId === layerId && r.target.param === axis);
      scene.routes = scene.routes.filter((r) => r !== prev);
      if (source === "touch") return;
      scene.routes.push({
        id: `${layerId}-${axis}`,
        source,
        sourceIndex: 0,
        target: { layerId, param: axis },
        amount: prev?.amount ?? 0.5,
        curve: "lin",
        // El secuenciador fija el valor de cada paso; el resto se suma al gesto.
        mode: source === "seq" ? "replace" : "add",
      });
    });

  // Fichas: apagada → enciende y selecciona; encendida → selecciona. El panel abre el detalle
  // y desde ahí se quita (estilo Picsart; sustituye a "tocar la seleccionada la apaga" de 4.2).
  const onTile = (tile: TileRef) => {
    if (readOnly) return;
    const name = tile.kind === "effect" ? tile.effect : tile.generator;
    const layer = layers.find((l) =>
      tile.kind === "effect" ? l.kind === "effect" && l.effect === tile.effect : l.kind === "generator" && l.generator === tile.generator,
    );
    if (!layer) {
      if (!canAddLayer(layers)) return setNotice(`MÁXIMO ${MAX_LAYERS} CAPAS`);
      const id = `${name}-${Date.now().toString(36)}`;
      // Sobre una foto, `screen` deja ver la imagen; `replace` la taparía por completo.
      const next: Layer =
        tile.kind === "effect"
          ? { kind: "effect", id, effect: tile.effect, params: { ...EFFECT_BY_ID[tile.effect].defaults }, visible: true }
          : {
              kind: "generator",
              id,
              generator: tile.generator,
              params: { ...GENERATOR_BY_ID[tile.generator].defaults },
              visible: true,
              blend: "screen",
            };
      sceneStore.getState().commit(`encender ${name}`, (scene) => {
        scene.layers.push(next);
      });
      setSelectedId(id);
    } else {
      setSelectedId(layer.id);
    }
  };

  const removeLayer = (layerId: string) => {
    sceneStore.getState().commit("quitar capa", (scene) => {
      scene.layers = scene.layers.filter((l) => l.id !== layerId);
      scene.routes = scene.routes.filter((r) => r.target.layerId !== layerId);
    });
    setSelectedId(layers.filter((l) => l.id !== layerId).at(-1)?.id ?? null);
  };

  const resetLayer = (layerId: string) =>
    sceneStore.getState().commit("reiniciar efecto", (scene) => {
      const layer = scene.layers.find((l) => l.id === layerId);
      if (layer?.kind === "effect") layer.params = { ...EFFECT_BY_ID[layer.effect].defaults };
      if (layer?.kind === "generator") layer.params = { ...GENERATOR_BY_ID[layer.generator].defaults };
    });

  // Deslizador de parámetro: vista previa sin historial mientras se arrastra y un solo
  // cambio deshacible al soltar (3.8: un movimiento completo de deslizador).
  const paramStart = useRef<{ x: number; y: number } | null>(null);
  const paramPending = useRef<{ layerId: string; params: { x: number; y: number } } | null>(null);
  const paramTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushParam = () => {
    if (paramTimer.current) clearTimeout(paramTimer.current);
    paramTimer.current = null;
    const pending = paramPending.current;
    paramPending.current = null;
    if (pending) setParams(pending.layerId, pending.params, null);
  };
  const setParams = (layerId: string, params: { x: number; y: number }, label: string | null) => {
    const recipe = (scene: { layers: Layer[] }) => {
      const layer = scene.layers.find((l) => l.id === layerId);
      if (layer) layer.params = params;
    };
    if (label) sceneStore.getState().commit(label, recipe);
    else sceneStore.getState().adjust(recipe);
  };

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
            routes={project.scene.routes}
            sources={project.scene.sources}
            seed={project.scene.seed}
            crop={isClip ? undefined : project.scene.crop.rect}
            paintable={!isClip}
            brush={
              activeTool === "brush" && !readOnly
                ? { tool: brushTool, size: brushSize, spacing: brushSpacing, sceneSeed: project.scene.seed }
                : null
            }
            strokes={strokes}
            mediaWidth={media.width}
            mediaHeight={media.height}
            showSizePreview={sizePreview}
            onCommitStroke={(stamps) =>
              sceneStore.getState().commit("trazo", (scene) => {
                const index = scene.paint.strokes.length;
                scene.paint.strokes.push({
                  id: `s${Date.now().toString(36)}-${index}`,
                  strokeSeed: stampSeed(scene.seed, index, 0),
                  stamps,
                });
              })
            }
            xyLayerId={activeTool === "effects" && !readOnly ? (selected?.id ?? null) : null}
            onCommitXY={(id, x, y) =>
              sceneStore.getState().commit("ajustar efecto", (scene) => {
                const layer = scene.layers.find((l) => l.id === id);
                if (layer) layer.params = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
              })
            }
            onResetXY={resetLayer}
          />
        ) : (
          <View style={styles.noImage}>
            <Text style={styles.label}>{media.file ? "CARGANDO…" : "SIN IMAGEN"}</Text>
          </View>
        )}
        {showCostWarning && (
          <Text style={styles.warning}>RENDIMIENTO BAJO · {layers.length} CAPAS</Text>
        )}
        {notice && <Text style={styles.notice}>{notice}</Text>}
      </View>

      {openPanel && (
        <PanelSheet>
          {openPanel === "brush" ? (
            <BrushPanel
              tool={brushTool}
              size={brushSize}
              spacing={brushSpacing}
              strokes={strokes.length}
              maxStrokes={MAX_STROKES}
              onTool={setBrushTool}
              onSize={setBrushSize}
              onSpacing={setBrushSpacing}
              onPreview={setSizePreview}
            />
          ) : openPanel === "effects" ? (
            <EffectsPanel
              layers={layers}
              selectedLayerId={selected?.id ?? null}
              warning={
                hasFastLuminanceRoute(layers, project.scene.routes, project.scene.sources)
                  ? "AVISO · DESTELLOS RÁPIDOS (> 3 HZ) SOBRE UNA ZONA AMPLIA"
                  : null
              }
              renderThumb={(layer) => <EffectThumb image={image} layer={layer} seed={project.scene.seed} size={THUMB_SIZE} />}
              onTile={onTile}
              onRemove={removeLayer}
              onReset={resetLayer}
              onBlend={(layerId, blend) =>
                sceneStore.getState().commit("modo de mezcla", (scene) => {
                  const layer = scene.layers.find((l) => l.id === layerId);
                  if (layer?.kind === "generator") layer.blend = blend;
                })
              }
              onSeed={(layerId) =>
                sceneStore.getState().commit("semilla", (scene) => {
                  const layer = scene.layers.find((l) => l.id === layerId);
                  if (layer?.kind === "generator") layer.seed = Math.floor(Math.random() * 1000);
                })
              }
              onParamStart={(layerId) => {
                const layer = layers.find((l) => l.id === layerId);
                paramStart.current = layer ? { ...layer.params } : null;
              }}
              onParam={(layerId, axis, value) => {
                const base = paramPending.current?.params ?? sceneStore.getState().project?.scene.layers.find((l) => l.id === layerId)?.params;
                if (!base) return;
                paramPending.current = { layerId, params: { ...base, [axis]: value } };
                if (!paramTimer.current) paramTimer.current = setTimeout(flushParam, 60);
              }}
              onParamEnd={(layerId) => {
                flushParam();
                const start = paramStart.current;
                const layer = sceneStore.getState().project?.scene.layers.find((l) => l.id === layerId);
                paramStart.current = null;
                if (!start || !layer || (start.x === layer.params.x && start.y === layer.params.y)) return;
                const final = { ...layer.params };
                // Se vuelve al valor inicial sin historial y se confirma el final como un solo cambio.
                setParams(layerId, start, null);
                setParams(layerId, final, "ajustar efecto");
              }}
              onModulate={() => setOverlays((stack) => toggleOverlay(stack, "mod"))}
            />
          ) : openPanel === "mod" ? (
            <ModPanel
              layer={
                selected
                  ? {
                      id: selected.id,
                      label: selected.kind === "effect" ? EFFECT_BY_ID[selected.effect].label : GENERATOR_BY_ID[selected.generator].label,
                    }
                  : null
              }
              routes={project.scene.routes}
              onRouteSource={setRouteSource}
              onRouteAmount={(layerId, axis, amount) =>
                sceneStore.getState().commit("cantidad de modulación", (scene) => {
                  const r = scene.routes.find((x) => x.target.layerId === layerId && x.target.param === axis);
                  if (r) r.amount = amount;
                })
              }
              sources={project.scene.sources}
              onSources={(next) =>
                sceneStore.getState().commit("ajustar fuente", (scene) => {
                  scene.sources = next;
                })
              }
              onTempo={(bpm) =>
                sceneStore.getState().adjust((scene) => {
                  scene.sources.tempo.bpm = bpm;
                })
              }
            />
          ) : openPanel === "export" ? (
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
  warning: {
    position: "absolute",
    top: 8,
    right: 8,
    color: colors.paperText,
    backgroundColor: colors.paper,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.2,
    paddingHorizontal: 6,
    paddingVertical: 2,
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
