import { useImage, useVideo } from "@shopify/react-native-skia";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { confirmLeave } from "../actions/leaveGuard";
import {
  addModulation,
  addTileLayer,
  calibrateMic,
  commitStroke,
  commitXY,
  findTileLayer,
  removeLayer,
  removeModulation,
  resetLayer,
  setGestureClip,
} from "../actions/sceneEdits";
import { EditorCanvas } from "../canvas/EditorCanvas";
import { MIN_GESTURE_MS } from "../actions/gestureLibrary";
import { applyScenePreset } from "../actions/scenePresets";
import type { SceneFade } from "../canvas/FadeOutScene";
import { GestureRecorder } from "../canvas/GestureRecorder";
import { OrientationSensor } from "../canvas/OrientationSensor";
import { LiveModContext, useModBus } from "../canvas/modBus";
import { StageView, type StageMode } from "../canvas/StageView";
import { useSlowFrames } from "../canvas/useSlowFrames";
import type { Project, ScenePreset } from "../domain/types";
import { FACTORY_PRESETS } from "../engine/factoryPresets";
import { croppedSize } from "../engine/crop";
import { isCostHigh, MAX_LAYERS } from "../engine/layerCost";
import { MAX_STROKES, type BrushTool } from "../paint/strokeInterpolate";
import { useMicMeter } from "../platform/useMicMeter";
import { PREVIEW_FILE } from "../project/storage";
import { projectFs, sceneStore, useScene } from "../state/activeScene";
import { settingsStore, useSettings } from "../state/appSettings";
import { EditorPanels } from "../ui/editor/EditorPanels";
import { EditorToolbar } from "../ui/editor/EditorToolbar";
import { EditorTopBar } from "../ui/editor/EditorTopBar";
import { GestureRecordContext } from "../ui/editor/gestureRecord";
import type { TileRef } from "../ui/editor/EffectsPanel";
import { toggleOverlay, type OverlayStack, type PanelId, type ToolButtonId } from "../ui/editor/panels";
import { useExportJob } from "../ui/editor/useExportJob";
import { askConfirm } from "../state/confirm";
import { announce } from "../ui/errors";
import { Toast } from "../ui/kit/Toast";
import { colors, space, type } from "../ui/tokens";
import { useLayout } from "../ui/useLayout";

// pantalla del proyecto abierto, apilada sobre las pestañas: se entra desde Cámara, Galería o el
// editor vacío y "volver" regresa a la pestaña de donde se vino
export default function ProjectScreen() {
  const project = useScene((s) => s.project);
  // el proyecto se cierra al desmontarse la pantalla, después de la animación de salida
  useEffect(() => () => sceneStore.getState().close(), []);
  if (!project) return <View style={{ flex: 1, backgroundColor: colors.ink }} />;
  return <ProjectView project={project} />;
}

// sale del proyecto a la pantalla anterior del stack (o a la Galería si se abrió sin historial)
function leaveProject() {
  if (router.canGoBack()) router.back();
  else router.replace("/gallery");
}

// opacidad de las barras mientras el dedo trabaja sobre la imagen
const CHROME_DIM = 0.3;

function ProjectView({ project }: { project: Project }) {
  const readOnly = useScene((s) => s.readOnly);
  const saveStatus = useScene((s) => s.saveStatus);
  const isDraft = useScene((s) => s.draft);
  const canUndo = useScene((s) => s.history.past.length > 0);
  const canRedo = useScene((s) => s.history.future.length > 0);
  const { regular, landscape } = useLayout();
  const { media, layers } = project.scene;
  const strokes = project.scene.paint.strokes;

  // clips: el video se reproduce en bucle y sin sonido con sus capas encima; se pausa fuera de la
  // pestaña. su preview.jpg (primer cuadro limpio) sirve para las fichas de efectos
  const isClip = media.kind === "clip";
  const imageFile = isClip ? PREVIEW_FILE : media.file;
  const image = useImage(imageFile ? projectFs.uri(project.id, imageFile) : null);
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const video = useVideo(isClip && media.file ? projectFs.uri(project.id, media.file) : null, {
    looping: true,
    volume: 0,
    paused: !focused,
  });
  const content = croppedSize(media.width, media.height, project.scene.crop.rect);

  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    // el aviso no mueve el foco: VoiceOver lo lee aparte
    announce(notice);
    const id = setTimeout(() => setNotice(null), 2000);
    return () => clearTimeout(id);
  }, [notice]);

  // el micrófono solo se activa si hay rutas de MIC (o su editor está abierto) y el editor está a
  // la vista; se apaga al salir
  const [micVisible, setMicVisible] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  // también los ADSR que se disparan con golpes del micrófono
  const hasMicRoute = project.scene.routes.some(
    (r) => r.amount !== 0 && (r.source === "mic" || (r.source === "adsr" && r.settings?.adsr?.trigger === "mic")),
  );
  const mic = useMicMeter(focused && (hasMicRoute || micVisible || calibrating), project.scene.sources.mic);
  const calibrate = async () => {
    if (calibrating) return;
    setCalibrating(true);
    const samples = await mic.sample();
    setCalibrating(false);
    calibrateMic(samples);
    setNotice(samples.length > 0 ? "MICRÓFONO CALIBRADO" : "SIN LECTURAS · REVISA EL PERMISO");
  };

  // PINCEL activo al abrir (en clips no aplica)
  const [activeTool, setActiveTool] = useState<"brush" | "effects">(isClip ? "effects" : "brush");
  const [overlays, setOverlays] = useState<OverlayStack>([]);
  const openPanel = (overlays.at(-1) ?? null) as PanelId | null;
  const togglePanel = (id: PanelId) => setOverlays((stack) => toggleOverlay(stack, id));
  const [selectedId, setSelectedId] = useState<string | null>(() => layers.at(-1)?.id ?? null);
  const selected = layers.find((l) => l.id === selectedId) ?? null;
  const [brushTool, setBrushTool] = useState<BrushTool>("datamosh");
  const [brushSize, setBrushSize] = useState(0.35);
  const [brushSpacing, setBrushSpacing] = useState(0.25);
  const [sizePreview, setSizePreview] = useState(false);
  const [stage, setStage] = useState<StageMode | null>(null);
  const slowFrames = useSlowFrames();
  const showCostWarning = layers.length > 0 && (isCostHigh(layers) || slowFrames);

  const onToolPress = (id: ToolButtonId) => {
    if (id === "gyro") return toggleGyro();
    if (id === "brush" && isClip) return setNotice("PINCEL · SOLO FOTOS");
    if (id === "brush" && strokes.length >= MAX_STROKES) setNotice(`LÍMITE DE ${MAX_STROKES} TRAZOS`);
    if (id === "brush" || id === "effects") setActiveTool(id);
    // en Capas el gesto X/Y actúa sobre la capa abierta, como en Efectos
    if (id === "layers") setActiveTool("effects");
    togglePanel(id);
  };

  // fichas: apagada → enciende y selecciona; encendida → selecciona. desde el detalle se quita
  const onTile = (tile: TileRef) => {
    if (readOnly) return;
    const existing = findTileLayer(layers, tile);
    if (existing) return setSelectedId(existing.id);
    const id = addTileLayer(layers, tile);
    if (id) setSelectedId(id);
    else setNotice(`MÁXIMO ${MAX_LAYERS} CAPAS`);
  };

  const onRemove = (layerId: string) => {
    removeLayer(layerId);
    setSelectedId(layers.filter((l) => l.id !== layerId).at(-1)?.id ?? null);
  };

  // reloj del preview: el lienzo cuenta el tiempo desde que se monta (con la imagen lista); la
  // exportación usa el mismo instante para coincidir con lo que se ve
  const clockStart = useRef<number | null>(null);
  useEffect(() => {
    if (image) clockStart.current = Date.now();
  }, [image]);
  const previewTime = () => (clockStart.current === null ? 0 : (Date.now() - clockStart.current) / 1000);
  const exports = useExportJob(project, previewTime, setNotice);
  const onImportRecipe = async () => {
    const lastLayerId = await exports.onImportRecipe();
    if (lastLayerId !== null) setSelectedId(lastLayerId);
  };

  // las barras se atenúan mientras el dedo trabaja sobre la imagen y reaparecen 400 ms después de
  // soltar. el lienzo escribe working desde el hilo de UI
  const working = useSharedValue(0);
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: working.get() ? withTiming(CHROME_DIM, { duration: 150 }) : withDelay(400, withTiming(1, { duration: 200 })),
  }));

  // props del lienzo que comparten el editor y el modo escenario (mismo árbol, mismos valores)
  // señales en vivo que el lienzo escribe y la vista en vivo de cada modulación lee
  const bus = useModBus();

  // escenas disparables: aplicar un preset (deshacible) y fundir desde la escena anterior durante
  // n tiempos del reloj (0 = corte). Lo usan el panel Presets y la tira del modo escenario
  const sceneFade = useSettings((s) => s.sceneFade);
  const userScenes = useSettings((s) => s.scenes);
  const scenes = [...FACTORY_PRESETS, ...userScenes];
  const [fade, setFade] = useState<SceneFade | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );
  const triggerScene = (preset: ScenePreset) => {
    if (readOnly) return;
    const outgoing = { layers: project.scene.layers, routes: project.scene.routes };
    const last = applyScenePreset(preset);
    if (last) setSelectedId(last);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    if (sceneFade > 0 && image && outgoing.layers.length > 0) {
      const duration = (sceneFade * 60) / project.scene.sources.tempo.bpm;
      setFade({ ...outgoing, start: bus.time.get(), duration });
      fadeTimer.current = setTimeout(() => setFade(null), duration * 1000 + 80);
    } else {
      setFade(null);
    }
    setNotice(preset.name.toUpperCase());
  };

  // GIRO: el sensor solo se enciende si alguna capa lo usa. El botón de la barra lo activa o quita
  // en la capa seleccionada; al activarlo, la posición actual del teléfono es el centro
  const usesGyro = focused && project.scene.routes.some((r) => r.source === "orientation" && r.amount !== 0);
  const gyroRoute = selected ? project.scene.routes.find((r) => r.target.layerId === selected.id && r.source === "orientation") : undefined;
  const toggleGyro = () => {
    if (readOnly) return;
    if (!selected) return setNotice("ELIGE UNA CAPA EN EFECTOS O CAPAS");
    if (gyroRoute) {
      removeModulation(gyroRoute.id);
      return setNotice("GIRO DESACTIVADO");
    }
    if (!addModulation(project.scene.routes, selected.id, "x", "orientation")) return setNotice("MÁXIMO 4 MODULACIONES POR CAPA");
    bus.oriCalibrate.set(bus.oriCalibrate.get() + 1);
    setNotice("GIRO ACTIVO · INCLINA EL TELÉFONO");
  };

  // grabación de un gesto: el panel se oculta (sin desmontarse) y una capa sobre el lienzo captura
  // el dedo; al soltar, el gesto queda en su modulación y se repite en bucle
  const [recordingRoute, setRecordingRoute] = useState<string | null>(null);
  const gestureRecord = { start: (routeId: string) => setRecordingRoute(routeId), notice: setNotice };
  const onGestureDone = useCallback(
    (clip: { durationMs: number; samples: number[] }) => {
      const id = recordingRoute;
      setRecordingRoute(null);
      if (!id) return;
      if (clip.durationMs < MIN_GESTURE_MS) return setNotice("GESTO MUY CORTO · MANTÉN Y MUEVE EL DEDO");
      setGestureClip(id, clip);
      setNotice("GESTO GRABADO · SE REPITE EN BUCLE");
    },
    [recordingRoute],
  );
  const canvasProps = {
    bus,
    fadeFrom: fade,
    // solo se usa cuando la imagen ya cargó (ambos lienzos van dentro de image && …)
    image: isClip ? video.currentFrame : image!,
    mic: { level: mic.level, hits: mic.hits },
    rotation: isClip ? video.rotation : (0 as const),
    sourceSize: isClip ? video.size : undefined,
    contentWidth: content.width,
    contentHeight: content.height,
    layers,
    routes: project.scene.routes,
    sources: project.scene.sources,
    seed: project.scene.seed,
    crop: project.scene.crop.rect,
    paintable: !isClip,
    strokes,
    mediaWidth: media.width,
    mediaHeight: media.height,
    xyLayerId: activeTool === "effects" && !readOnly ? (selected?.id ?? null) : null,
    onCommitXY: commitXY,
    onResetXY: resetLayer,
  };

  // menú ⋯: reabrir el onboarding (el modo escenario tiene su propio botón y panel)
  const openMore = () =>
    void askConfirm({
      section: "EDITOR",
      title: "Más opciones",
      actions: [{ id: "intro", label: "Ver introducción", icon: "questionmark.circle", variant: "secondary" }],
    }).then((id) => id === "intro" && settingsStore.getState().update({ onboardingSeen: false }));
  const startStage = (mode: StageMode) => {
    if (!image) return setNotice("CARGANDO LA IMAGEN…");
    setOverlays([]);
    setStage(mode);
  };

  const toolbar = (
    <Animated.View style={chromeStyle}>
      <EditorToolbar
        activeTool={activeTool}
        openPanel={openPanel}
        disabled={{ brush: isClip, gyro: readOnly }}
        on={{ gyro: gyroRoute !== undefined }}
        onPress={onToolPress}
        rail={regular}
      />
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.root, regular && styles.rootRail]} edges={["top"]}>
      {regular && toolbar}
      <View style={styles.main}>
        <Animated.View style={chromeStyle}>
          <EditorTopBar
            canUndo={canUndo && !readOnly}
            canRedo={canRedo && !readOnly}
            unsaved={!readOnly && (isDraft || saveStatus.state !== "saved")}
            exportOpen={openPanel === "export"}
            stageOpen={openPanel === "stage"}
            onBack={() => {
              void confirmLeave().then((leave) => {
                if (leave) leaveProject();
              });
            }}
            onUndo={() => sceneStore.getState().undo()}
            onRedo={() => sceneStore.getState().redo()}
            onExport={() => togglePanel("export")}
            onStage={() => togglePanel("stage")}
            onMore={openMore}
          />
        </Animated.View>
        <View style={styles.work}>
          <View style={styles.canvasArea}>
            {image ? (
              !stage && (
                <EditorCanvas
                  {...canvasProps}
                  working={working}
                  brush={
                    activeTool === "brush" && !readOnly
                      ? { tool: brushTool, size: brushSize, spacing: brushSpacing, sceneSeed: project.scene.seed }
                      : null
                  }
                  showSizePreview={sizePreview}
                  onCommitStroke={commitStroke}
                />
              )
            ) : (
              <View style={styles.noImage}>
                <Text style={styles.label}>{media.file ? "CARGANDO…" : "SIN IMAGEN"}</Text>
              </View>
            )}
            {showCostWarning && (
              <Toast tone="status" icon="gauge.with.dots.needle.67percent" text={`RENDIMIENTO BAJO · ${layers.length} CAPAS`} style={styles.warning} />
            )}
            {recordingRoute && image && !stage && (
              <GestureRecorder bus={bus} routeId={recordingRoute} onDone={onGestureDone} onCancel={() => setRecordingRoute(null)} />
            )}
          </View>

          {/* capa flotante sobre el lienzo: el panel nunca cambia el tamaño ni la posición de la
              imagen; fuera del panel los toques siguen llegando al lienzo */}
          {/* sube con el teclado (p. ej. al renombrar en Exportar) para que el campo quede a la vista */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.overlay, landscape && styles.overlaySide, recordingRoute !== null && styles.hidden]}
            pointerEvents="box-none"
          >
            {notice && <Toast text={notice} style={styles.notice} />}
            {openPanel && (
              <LiveModContext.Provider value={{ bus, micLevel: mic.level, seed: project.scene.seed }}>
                <GestureRecordContext.Provider value={gestureRecord}>
                  <EditorPanels
                    panel={openPanel}
                    project={project}
                    image={image}
                    selected={selected}
                    brush={{
                      tool: brushTool,
                      size: brushSize,
                      spacing: brushSpacing,
                      onTool: setBrushTool,
                      onSize: setBrushSize,
                      onSpacing: setBrushSpacing,
                      onPreview: setSizePreview,
                    }}
                    mic={{ state: mic.state, db: mic.db, calibrating, onCalibrate: () => void calibrate() }}
                    onMicVisible={setMicVisible}
                    onTile={onTile}
                    onSelect={setSelectedId}
                    onRemove={onRemove}
                    onOpenEffects={() => onToolPress("effects")}
                    onNotice={setNotice}
                    onClose={() => setOverlays([])}
                  onStartStage={startStage}
                  onTriggerScene={triggerScene}
                    exports={exports}
                    onImportRecipe={() => void onImportRecipe()}
                  />
                </GestureRecordContext.Provider>
              </LiveModContext.Provider>
            )}
          </KeyboardAvoidingView>
        </View>

        {usesGyro && <OrientationSensor bus={bus} />}
        {stage && image && (
          <StageView
            mode={stage}
            // en escenario el gesto X/Y actúa sobre el efecto seleccionado aunque la herramienta
            // sea el pincel
            canvas={{ ...canvasProps, xyLayerId: readOnly ? null : (selected?.id ?? null) }}
            scenes={readOnly ? [] : scenes}
            onScene={triggerScene}
            fadeBeats={sceneFade}
            onFadeBeats={(b) => settingsStore.getState().update({ sceneFade: b })}
            onExit={() => setStage(null)}
          />
        )}
      </View>
      {!regular && toolbar}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  rootRail: { flexDirection: "row" },
  main: { flex: 1 },
  work: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  // iPad horizontal: la tarjeta lateral ocupa del borde superior al inferior del área de trabajo
  overlaySide: { justifyContent: "flex-start", paddingBottom: 8 },
  // oculto sin desmontar: el panel conserva su estado mientras se graba un gesto
  hidden: { display: "none" },
  canvasArea: { flex: 1, marginHorizontal: 18, marginBottom: 8 },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.inkSurface, borderRadius: 12 },
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  notice: { marginBottom: 20 },
  warning: { position: "absolute", top: space.sm },
});
