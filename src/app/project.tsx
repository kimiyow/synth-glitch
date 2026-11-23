import { useImage, useVideo } from "@shopify/react-native-skia";
import { router, useFocusEffect, usePreventRemove } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { confirmLeave } from "../actions/leaveGuard";
import {
  addTileLayer,
  applySceneVariation,
  calibrateMic,
  commitStroke,
  commitXY,
  findTileLayer,
  removeLayer,
  resetLayer,
  setGestureClip,
} from "../actions/sceneEdits";
import { EditorCanvas } from "../canvas/EditorCanvas";
import { MIN_GESTURE_MS } from "../actions/gestureLibrary";
import { applyScenePreset, findSameScene } from "../actions/scenePresets";
import type { SceneFade } from "../canvas/FadeOutScene";
import { GestureTrail } from "../canvas/GestureTrail";
import { GestureRecorder } from "../canvas/GestureRecorder";
import { LiveModContext, useModBus } from "../canvas/modBus";
import { StageView, type StageMode } from "../canvas/StageView";
import { useSlowFrames } from "../canvas/useSlowFrames";
import type { GestureClip, Layer, Project, Route, ScenePreset } from "../domain/types";
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
import { layerDef } from "../ui/editor/LayerInspector";
import { GestureRecordContext } from "../ui/editor/gestureRecord";
import type { TileRef } from "../ui/editor/EffectsPanel";
import { popOverlay, pushOverlay, toggleOverlay, type OverlayStack, type PanelId, type ToolButtonId } from "../ui/editor/panels";
import { useExportJob } from "../ui/editor/useExportJob";
import { askConfirm } from "../state/confirm";
import { hasUnsavedWork } from "../state/sceneStore";
import { announce } from "../ui/errors";
import { Toast } from "../ui/kit/Toast";
import { PrivacyNotice } from "../ui/PrivacyNotice";
import { useKeyboardOverlap } from "../ui/useKeyboardOverlap";
import { colors, radius, space, type } from "../ui/tokens";
import { useLayout } from "../ui/useLayout";

// pantalla del proyecto abierto, apilada sobre las pestañas: se entra desde Cámara, Galería o el
// editor vacío y "volver" regresa a la pestaña de donde se vino
// paneles que abre la barra de herramientas (Exportar y Escenario son de la barra superior)
const TOOLBAR_PANELS: readonly ToolButtonId[] = ["brush", "effects", "layers", "mod", "presets"];
const isToolbarPanel = (id: PanelId): id is ToolButtonId => (TOOLBAR_PANELS as readonly string[]).includes(id);

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
  // salir (botón Volver, deslizar desde el borde o el sistema) con trabajo sin guardar se frena y
  // pregunta; un solo camino para todas las salidas
  const unsavedWork = useScene((s) => hasUnsavedWork(s));
  // salida ya confirmada: primero se apaga la protección y, en el render siguiente, se repite
  const [leaving, setLeaving] = useState<{ repeat: () => void } | null>(null);
  usePreventRemove(unsavedWork && leaving === null, ({ repeat }) => {
    void confirmLeave().then((leave) => {
      if (leave) setLeaving({ repeat });
    });
  });
  useEffect(() => {
    leaving?.repeat();
  }, [leaving]);
  const saveStatus = useScene((s) => s.saveStatus);
  const isDraft = useScene((s) => s.draft);
  const canUndo = useScene((s) => s.history.past.length > 0);
  const canRedo = useScene((s) => s.history.future.length > 0);
  const { regular, landscape } = useLayout();
  const { ref: keyboardRef, overlap: keyboardOverlap } = useKeyboardOverlap();
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

  // herramienta del dedo; null = ninguna (el dedo no pinta ni ajusta; el pellizco sigue). Al abrir
  // el editor no hay ninguna ni panel marcado: el usuario elige
  const [activeTool, setActiveTool] = useState<"brush" | "effects" | null>(null);
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

  // la barra es un juego de interruptores: el botón marcado (el panel abierto o, sin panel de la
  // barra, la herramienta del dedo) se apaga al tocarlo; uno sin marcar se enciende
  // el panel Gesto se abre desde Modulación: mientras está abierto, la barra marca Modulación
  const toolbarPanel = openPanel === "gesture" ? "mod" : openPanel !== null && isToolbarPanel(openPanel) ? openPanel : null;
  const highlighted: ToolButtonId | null = toolbarPanel ?? activeTool;
  // con Capas o Modulación abiertos el dedo ajusta X/Y de la capa abierta solo mientras siguen
  // abiertos; al cerrarlos vuelve la herramienta que había
  const fingerTool = openPanel === "layers" || openPanel === "mod" ? "effects" : activeTool;
  // pista de inicio: con el editor recién abierto (sin herramienta ni panel) se dice por dónde
  // empezar, hasta que se toca un botón de la barra
  const [toolTouched, setToolTouched] = useState(false);
  const showStartHint = !readOnly && !toolTouched && activeTool === null && openPanel === null;
  const onToolPress = (id: ToolButtonId) => {
    setToolTouched(true);
    if (id === highlighted) {
      // Modulación encendida por el panel Gesto (abierto desde ella) también lo cierra
      if (openPanel === id || (id === "mod" && openPanel === "gesture")) setOverlays([]);
      if (id === activeTool) setActiveTool(null);
      return;
    }
    if (id === "brush" && isClip) return setNotice("PINCEL · SOLO FOTOS");
    if (id === "brush" && strokes.length >= MAX_STROKES) setNotice(`LÍMITE DE ${MAX_STROKES} TRAZOS`);
    if (id === "brush" || id === "effects") setActiveTool(id);
    // Modulación abre la capa seleccionada; sin selección, la de arriba
    if (id === "mod" && !selected && layers.length > 0) setSelectedId(layers.at(-1)?.id ?? null);
    if (id === "mod") setModFocus(null);
    setOverlays([id]);
  };
  // desde el resumen de modulaciones de Capas o Efectos: el panel Modulación en esa capa, con la
  // modulación tocada abierta (la barra marca Modulación)
  const [modFocus, setModFocus] = useState<{ id: string | null; fresh: boolean } | null>(null);
  const openMod = (layerId: string, routeId: string | null, fresh: boolean) => {
    setSelectedId(layerId);
    setModFocus({ id: routeId, fresh });
    setOverlays(["mod"]);
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
  // escenas como interruptor: no se apilan. Al aplicar una escena desde un estado propio, ese estado
  // queda como original; tocar la escena activa la quita y vuelve a él (con la misma transición).
  // El original es de esta sesión del proyecto; sin él, quitar la escena deja la imagen sin capas
  const activeScene = findSameScene(scenes, project.scene.layers, project.scene.routes);
  const sceneOriginal = useRef<{ projectId: string; layers: Layer[]; routes: Route[] } | null>(null);
  const triggerScene = (preset: ScenePreset) => {
    if (readOnly) return;
    const outgoing = { layers: project.scene.layers, routes: project.scene.routes };
    const original = sceneOriginal.current?.projectId === project.id ? sceneOriginal.current : null;
    let notice: string;
    if (activeScene?.id === preset.id) {
      const back = original ?? { layers: [], routes: [] };
      applySceneVariation({ layers: back.layers, routes: back.routes }, `quitar escena · ${preset.name}`);
      sceneOriginal.current = null;
      setSelectedId(back.layers.at(-1)?.id ?? null);
      notice = `${preset.name.toUpperCase()} QUITADA · VUELVE A COMO ESTABA`;
    } else {
      // entrar a una escena desde un estado propio (no desde otra escena) guarda ese estado
      if (!activeScene || !original) sceneOriginal.current = { projectId: project.id, layers: [...outgoing.layers], routes: [...outgoing.routes] };
      const last = applyScenePreset(preset);
      if (last) setSelectedId(last);
      notice = `${preset.name.toUpperCase()} · TÓCALA OTRA VEZ PARA QUITARLA`;
    }
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    if (sceneFade > 0 && image && outgoing.layers.length > 0) {
      const duration = (sceneFade * 60) / project.scene.sources.tempo.bpm;
      setFade({ ...outgoing, start: bus.time.get(), duration });
      fadeTimer.current = setTimeout(() => setFade(null), duration * 1000 + 80);
    } else {
      setFade(null);
    }
    setNotice(notice);
  };


  // grabación de un gesto: el panel se oculta (sin desmontarse) y una capa sobre el lienzo captura
  // el dedo; al soltar, el gesto queda en su modulación y se repite en bucle
  const [recordingRoute, setRecordingRoute] = useState<string | null>(null);
  const gestureRecord = {
    start: (routeId: string) => setRecordingRoute(routeId),
    notice: setNotice,
    open: () => setOverlays((stack) => (stack.at(-1) === "gesture" ? stack : pushOverlay(stack, "gesture"))),
  };
  // estela del gesto de la capa seleccionada sobre el lienzo: solo con el panel Gesto abierto (al
  // cerrarlo la imagen queda limpia); el ojo de la tarjeta la oculta también ahí
  const [trailVisible, setTrailVisible] = useState(true);
  // gesto guardado en vista previa (panel Gesto): se dibuja sobre la imagen, en la misma zona y
  // proporción en que se grabó, en lugar de la estela del gesto de la capa
  const [gesturePreview, setGesturePreview] = useState<GestureClip | null>(null);
  const selectedClip = selected
    ? project.scene.routes.find((r) => r.target.layerId === selected.id && r.source === "track" && r.amount !== 0 && (r.settings?.gesture?.samples.length ?? 0) >= 4)
        ?.settings?.gesture
    : undefined;
  // ejes de la capa que se graba (para la guía sobre el lienzo)
  const recordingLayer = recordingRoute
    ? layers.find((l) => l.id === project.scene.routes.find((r) => r.id === recordingRoute)?.target.layerId)
    : undefined;
  const recordingAxes = recordingLayer ? layerDef(recordingLayer).axes : { x: "X", y: "Y" };
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
    paintVisible: project.scene.paint.visible,
    paintIndex: project.scene.paint.index,
    mediaWidth: media.width,
    mediaHeight: media.height,
    xyLayerId: fingerTool === "effects" && !readOnly ? (selected?.id ?? null) : null,
    onCommitXY: commitXY,
    onResetXY: resetLayer,
  };

  // menú ⋯: reabrir la introducción o leer el aviso de privacidad (el modo escenario tiene su
  // propio botón y panel)
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const openMore = () =>
    void askConfirm({
      section: "EDITOR",
      title: "Más opciones",
      actions: [
        { id: "intro", label: "Ver introducción", icon: "questionmark.circle", variant: "secondary" },
        { id: "privacy", label: "Aviso de privacidad", icon: "lock.shield", variant: "secondary" },
      ],
    }).then((id) => {
      if (id === "intro") settingsStore.getState().update({ onboardingSeen: false });
      if (id === "privacy") setPrivacyOpen(true);
    });
  const startStage = (mode: StageMode) => {
    if (!image) return setNotice("CARGANDO LA IMAGEN…");
    setOverlays([]);
    setStage(mode);
  };

  const toolbar = (
    <Animated.View style={chromeStyle}>
      <EditorToolbar
        highlighted={highlighted}
        disabled={{ brush: isClip }}
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
            readOnly={readOnly}
            onSave={() => void exports.onExportAction("project")}
            exportOpen={openPanel === "export"}
            stageOpen={openPanel === "stage"}
            onBack={leaveProject}
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
                    fingerTool === "brush" && !readOnly
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
            {openPanel === "gesture" && gesturePreview && image && !stage && !recordingRoute ? (
              <GestureTrail bus={bus} clip={gesturePreview} />
            ) : (
              openPanel === "gesture" &&
              trailVisible &&
              selectedClip &&
              selected?.visible &&
              image &&
              !stage &&
              !recordingRoute && <GestureTrail bus={bus} clip={selectedClip} />
            )}
            {showCostWarning && (
              <Toast tone="status" icon="gauge.with.dots.needle.67percent" text={`RENDIMIENTO BAJO · ${layers.length} CAPAS`} style={styles.warning} />
            )}
            {recordingRoute && image && !stage && (
              <GestureRecorder
                bus={bus}
                routeId={recordingRoute}
                axes={recordingAxes}
                base={recordingLayer?.params ?? { x: 0.5, y: 0.5 }}
                onDone={onGestureDone}
                onCancel={() => setRecordingRoute(null)}
              />
            )}
          </View>

          {/* capa flotante sobre el lienzo: el panel nunca cambia el tamaño ni la posición de la
              imagen; fuera del panel los toques siguen llegando al lienzo */}
          {/* sube con el teclado (renombrar en Exportar, Gesto o Escenas) hasta que el campo quede a la vista */}
          <View
            ref={keyboardRef}
            style={[
              styles.overlay,
              landscape && styles.overlaySide,
              keyboardOverlap > 0 && { paddingBottom: keyboardOverlap + 8 },
              recordingRoute !== null && styles.hidden,
            ]}
            pointerEvents="box-none"
          >
            {notice && <Toast text={notice} style={styles.notice} />}
            {showStartHint && !notice && (
              <View style={styles.startHint} pointerEvents="none" accessibilityLiveRegion="polite">
                <Text style={styles.startHintText}>Elige Pincel para pintar o Efectos para añadir uno</Text>
              </View>
            )}
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
                    onOpenBrush={() => onToolPress("brush")}
                    onOpenMod={openMod}
                    modFocus={modFocus}
                    onNotice={setNotice}
                    onClose={() => setOverlays(popOverlay)}
                    backTo={(overlays.length > 1 ? (overlays.at(-2) ?? null) : null) as PanelId | null}
                  onStartStage={startStage}
                  onTriggerScene={triggerScene}
                    exports={exports}
                    trail={{ visible: trailVisible, onToggle: () => setTrailVisible((v) => !v) }}
                    onGesturePreview={setGesturePreview}
                    onImportRecipe={() => void onImportRecipe()}
                  />
                </GestureRecordContext.Provider>
              </LiveModContext.Provider>
            )}
          </View>
        </View>

        {stage && image && (
          <StageView
            mode={stage}
            // en escenario el gesto X/Y actúa sobre el efecto seleccionado aunque la herramienta
            // sea el pincel
            canvas={{ ...canvasProps, xyLayerId: readOnly ? null : (selected?.id ?? null) }}
            scenes={readOnly ? [] : scenes}
            activeSceneId={activeScene?.id ?? null}
            onScene={triggerScene}
            fadeBeats={sceneFade}
            onFadeBeats={(b) => settingsStore.getState().update({ sceneFade: b })}
            onExit={() => setStage(null)}
          />
        )}
      </View>
      {!regular && toolbar}
      {privacyOpen && <PrivacyNotice onClose={() => setPrivacyOpen(false)} />}
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
  startHint: {
    alignSelf: "center",
    marginBottom: 20,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.inkSurface,
  },
  startHintText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label + 1 },
  warning: { position: "absolute", top: space.sm },
});
