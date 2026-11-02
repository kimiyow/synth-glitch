import {
  Canvas,
  ImageShader,
  Rect,
  Skia,
  type SkImage,
} from "@shopify/react-native-skia";
import * as MediaLibrary from "expo-media-library";
import { File } from "expo-file-system";
import { router, useIsFocused } from "expo-router";
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useVideo } from "@shopify/react-native-skia";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  EFFECTS,
  type EffectId,
} from "../effects/registry";
import {
  exportEffectedFrame,
  exportEffectedPhoto,
} from "../editor/exportImage";
import {
  createLayer,
  useEditorStore,
} from "../state/editorStore";
import {
  estimateLayerCost,
  LAYER_COST_WARNING_THRESHOLD,
  MAX_LAYER_COUNT,
} from "../layers/layerCost";
import { LayerShader } from "../layers/LayerShader";
import { useLayerPerformance } from "../layers/useLayerPerformance";
import { cloneSceneConfig } from "../undo/undoStack";
import type { Layer } from "../state/types";
import { CornerMarks } from "../ui/CornerMarks";
import { colors, geometry, type } from "../ui/tokens";
import { useLayout } from "../ui/useLayout";

const RETICLE_SIZE = 24;
const CLIP_LOAD_TIMEOUT_MS = 8000;
type LoadedClip = {
  uri: string;
  currentFrame: SharedValue<SkImage | null>;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
};

const AnimatedTextInput = Animated.createAnimatedComponent(
  TextInput as ComponentType<AnimatedTextInputProps>,
);

type OpenMenu = "layers" | "save" | null;
type AnimatedTextInputProps = TextInputProps & { text?: string };

export default function EditorRoute() {
  const activeMedia = useEditorStore((state) => state.activeMedia);
  const clearActiveMedia = useEditorStore((state) => state.clearActiveMedia);
  const scene = useEditorStore((state) => state.scene);
  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const undoState = useEditorStore((state) => state.undoState);
  const lastChangeLabel = useEditorStore((state) => state.lastChangeLabel);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const commitScene = useEditorStore((state) => state.commitScene);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const clearChangeLabel = useEditorStore((state) => state.clearChangeLabel);
  const isFocused = useIsFocused();
  const photoUri = activeMedia?.type === "photo" ? activeMedia.uri : null;
  const clipUri = activeMedia?.type === "clip" ? activeMedia.uri : null;
  const [loadedPhoto, setLoadedPhoto] = useState<{
    uri: string;
    image: NonNullable<ReturnType<typeof Skia.Image.MakeImageFromEncoded>> | null;
    failed: boolean;
  } | null>(null);
  const [loadedClip, setLoadedClip] = useState<LoadedClip | null>(null);
  const [clipLoadFailedUri, setClipLoadFailedUri] = useState<string | null>(null);
  const currentPhoto = loadedPhoto?.uri === photoUri ? loadedPhoto : null;
  const currentClip = loadedClip?.uri === clipUri ? loadedClip : null;
  const image = currentPhoto?.image ?? null;
  const imageLoadError = currentPhoto?.failed ?? false;
  const clipLoadError = clipLoadFailedUri === clipUri;
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    text: string;
    failed: boolean;
  } | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);
  const [layerNotice, setLayerNotice] = useState<string | null>(null);
  const { margin, regular, scale } = useLayout();
  const activeLayer =
    scene.layers.find((layer) => layer.id === activeLayerId) ?? scene.layers[0];
  const activeLayerIndex = Math.max(
    0,
    scene.layers.findIndex((layer) => layer.id === activeLayer.id),
  );
  const layerParams = useSharedValue(
    scene.layers.flatMap((layer) => [layer.params.x, layer.params.y]),
  );
  const reticleOpacity = useSharedValue(0);
  const chromeOpacity = useSharedValue(1);
  const clock = useSharedValue(0);
  const visibleLayerCount = scene.layers.filter((layer) => layer.visible).length;
  const layerCost = estimateLayerCost(scene.layers);
  const isPerformanceLow = useLayerPerformance(visibleLayerCount);
  const activeX = useDerivedValue(
    () => layerParams.get()[activeLayerIndex * 2] ?? activeLayer.params.x,
  );
  const activeY = useDerivedValue(
    () => layerParams.get()[activeLayerIndex * 2 + 1] ?? activeLayer.params.y,
  );

  useEffect(() => {
    layerParams.set(scene.layers.flatMap((layer) => [layer.params.x, layer.params.y]));
  }, [layerParams, scene]);

  useEffect(() => {
    if (!lastChangeLabel) {
      return;
    }
    const timeoutId = setTimeout(clearChangeLabel, 1200);
    return () => clearTimeout(timeoutId);
  }, [clearChangeLabel, lastChangeLabel]);

  useEffect(() => {
    let isCurrentPhoto = true;
    if (!photoUri) {
      return () => {
        isCurrentPhoto = false;
      };
    }

    const loadPhoto = async () => {
      try {
        const data = await Skia.Data.fromURI(photoUri);
        const decodedImage = Skia.Image.MakeImageFromEncoded(data);
        if (!decodedImage) {
          throw new Error("Skia no pudo decodificar la foto capturada.");
        }
        if (isCurrentPhoto) {
          setLoadedPhoto({ uri: photoUri, image: decodedImage, failed: false });
        }
      } catch (error) {
        console.error("No se pudo cargar la foto capturada en el editor.", error);
        if (isCurrentPhoto) {
          setLoadedPhoto({ uri: photoUri, image: null, failed: true });
        }
      }
    };

    void loadPhoto();
    return () => {
      isCurrentPhoto = false;
    };
  }, [photoUri]);

  const handleClipLoaded = useCallback((clip: LoadedClip) => {
    setLoadedClip(clip);
    setClipLoadFailedUri(null);
  }, []);

  useEffect(() => {
    if (!clipUri || !isFocused || currentClip) {
      return;
    }

    const timeoutId = setTimeout(() => {
      console.error("Skia no pudo cargar el clip para reproducirlo.");
      setClipLoadFailedUri(clipUri);
    }, CLIP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [clipUri, currentClip, isFocused]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      clock.set(clock.get() + 0.016);
    }, 16);
    return () => clearInterval(intervalId);
  }, [clock]);

  useEffect(() => {
    if (!saveMessage || saveMessage.failed) {
      return;
    }
    const timeoutId = setTimeout(() => setSaveMessage(null), 2000);
    return () => clearTimeout(timeoutId);
  }, [saveMessage]);

  useEffect(() => {
    if (!layerNotice) {
      return;
    }
    const timeoutId = setTimeout(() => setLayerNotice(null), 2400);
    return () => clearTimeout(timeoutId);
  }, [layerNotice]);

  const clipRotatedSideways =
    currentClip?.rotation === 90 || currentClip?.rotation === 270;
  const mediaWidth =
    image?.width() ??
    (clipRotatedSideways ? currentClip?.height : currentClip?.width) ??
    0;
  const mediaHeight =
    image?.height() ??
    (clipRotatedSideways ? currentClip?.width : currentClip?.height) ??
    0;
  const hasImage = mediaWidth > 0 && mediaHeight > 0;
  const imageSource = image ?? currentClip?.currentFrame ?? null;
  const drawSize = hasImage
    ? getContainSize(mediaWidth, mediaHeight, canvasSize.width, canvasSize.height)
    : { width: 0, height: 0 };
  const imageX = (canvasSize.width - drawSize.width) / 2;
  const imageY = (canvasSize.height - drawSize.height) / 2;
  const videoRotation = currentClip?.rotation ?? 0;
  const imageShaderRect =
    videoRotation === 90 || videoRotation === 270
      ? {
          x: (canvasSize.width - drawSize.height) / 2,
          y: (canvasSize.height - drawSize.width) / 2,
          width: drawSize.height,
          height: drawSize.width,
        }
      : {
          x: imageX,
          y: imageY,
          width: drawSize.width,
          height: drawSize.height,
        };
  const imageShaderTransform =
    videoRotation === 0
      ? undefined
      : [{ rotateZ: (videoRotation * Math.PI) / 180 }];
  const imageShaderOrigin =
    videoRotation === 0
      ? undefined
      : { x: canvasSize.width / 2, y: canvasSize.height / 2 };
  const shaderResolution: [number, number] = [drawSize.width, drawSize.height];
  const shaderTree = hasImage && imageSource
    ? scene.layers.reduce<ReactNode>((children, layer, index) => {
        if (!layer.visible) {
          return children;
        }
        return (
          <LayerShader
            index={index}
            key={layer.id}
            layer={layer}
            layerParams={layerParams}
            resolution={shaderResolution}
            time={clock}
          >
            {children}
          </LayerShader>
        );
      }, (
        <ImageShader
          image={imageSource}
          fit="contain"
          origin={imageShaderOrigin}
          rect={imageShaderRect}
          transform={imageShaderTransform}
        />
      ))
    : null;
  const reticleStyle = useAnimatedStyle(() => ({
    opacity: reticleOpacity.get(),
    transform: [
      { translateX: activeX.get() * drawSize.width - RETICLE_SIZE / 2 },
      { translateY: activeY.get() * drawSize.height - RETICLE_SIZE / 2 },
    ],
  }));
  const readoutStyle = useAnimatedStyle(() => ({
    opacity: reticleOpacity.get(),
    transform: [
      {
        translateX: Math.min(
          Math.max(activeX.get() * drawSize.width - 48, 0),
          Math.max(drawSize.width - 112, 0),
        ),
      },
      {
        translateY: Math.min(
          Math.max(activeY.get() * drawSize.height + 18, 0),
          Math.max(drawSize.height - 34, 0),
        ),
      },
    ],
  }));
  const readoutProps = useAnimatedProps(() => ({
    text: `X ${activeX.get().toFixed(2)}  Y ${activeY.get().toFixed(2)}`,
  }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: chromeOpacity.get(),
  }));
  const commitDraggedLayer = useCallback(
    (layerId: string, x: number, y: number) => {
      const currentScene = useEditorStore.getState().scene;
      const layerIndex = currentScene.layers.findIndex(
        (layer) => layer.id === layerId,
      );
      if (layerIndex < 0) {
        return;
      }

      const nextScene = cloneSceneConfig(currentScene);
      nextScene.layers[layerIndex].params = { x, y };
      useEditorStore
        .getState()
        .commitScene(`AJUSTE CAPA ${layerIndex + 1}`, nextScene);
    },
    [],
  );

  const panGesture = Gesture.Pan()
    .minDistance(4)
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      chromeOpacity.set(withTiming(0, { duration: 120 }));
      reticleOpacity.set(withTiming(1, { duration: 100 }));
    })
    .onUpdate((event) => {
      if (event.numberOfPointers !== 1 || drawSize.width <= 0 || drawSize.height <= 0) {
        return;
      }
      const nextParams = [...layerParams.get()];
      nextParams[activeLayerIndex * 2] = Math.min(
        Math.max(event.x / drawSize.width, 0),
        1,
      );
      nextParams[activeLayerIndex * 2 + 1] = Math.min(
        Math.max(event.y / drawSize.height, 0),
        1,
      );
      layerParams.set(nextParams);
    })
    .onFinalize((_event, success) => {
      if (success) {
        const values = layerParams.get();
        runOnJS(commitDraggedLayer)(
          activeLayer.id,
          values[activeLayerIndex * 2] ?? activeLayer.params.x,
          values[activeLayerIndex * 2 + 1] ?? activeLayer.params.y,
        );
      }
      chromeOpacity.set(withDelay(400, withTiming(1, { duration: 200 })));
      reticleOpacity.set(withDelay(1500, withTiming(0, { duration: 200 })));
    });

  const resetGesture = Gesture.Tap()
    .numberOfTaps(2)
    .minPointers(1)
    .maxDistance(3)
    .onEnd((_event, success) => {
      if (!success) {
        return;
      }
      const nextParams = [...layerParams.get()];
      nextParams[activeLayerIndex * 2] = activeLayer.params.x;
      nextParams[activeLayerIndex * 2 + 1] = activeLayer.params.y;
      layerParams.set(nextParams);
      runOnJS(commitDraggedLayer)(
        activeLayer.id,
        activeLayer.params.x,
        activeLayer.params.y,
      );
      reticleOpacity.set(
        withSequence(
          withTiming(1, { duration: 100 }),
          withDelay(1500, withTiming(0, { duration: 200 })),
        ),
      );
    });

  const gesture = Gesture.Simultaneous(panGesture, resetGesture);

  const handleDiscard = () => {
    const discardedMedia = useEditorStore.getState().activeMedia;
    clearActiveMedia();
    setSaveMessage(null);
    setNeedsSettings(false);
    setOpenMenu(null);
    setClipLoadFailedUri(null);
    router.navigate("/");
    if (discardedMedia?.type === "clip") {
      try {
        const clipFile = new File(discardedMedia.uri);
        if (clipFile.exists) {
          clipFile.delete();
        }
      } catch (error) {
        console.error("No se pudo limpiar el clip descartado.", error);
      }
    }
  };

  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    setOpenMenu((current) => (current === menu ? null : menu));
    setSaveMessage(null);
  };

  const updateScene = (
    label: string,
    update: (nextScene: ReturnType<typeof cloneSceneConfig>) => void,
  ) => {
    const nextScene = cloneSceneConfig(scene);
    update(nextScene);
    commitScene(label, nextScene);
  };

  const addLayer = () => {
    if (scene.layers.length >= MAX_LAYER_COUNT) {
      setLayerNotice(`LÍMITE TÉCNICO · ${MAX_LAYER_COUNT} CAPAS`);
      return;
    }
    const layer = createLayer(activeLayer.effect);
    updateScene("AÑADIR CAPA", (nextScene) => {
      nextScene.layers.push(layer);
    });
    setActiveLayer(layer.id);
    setLayerNotice(null);
  };

  const removeLayer = (layer: Layer) => {
    if (scene.layers.length <= 1) {
      setLayerNotice("LA ÚLTIMA CAPA NO SE PUEDE QUITAR");
      return;
    }
    const layerIndex = scene.layers.findIndex((entry) => entry.id === layer.id);
    updateScene("QUITAR CAPA", (nextScene) => {
      nextScene.layers = nextScene.layers.filter((entry) => entry.id !== layer.id);
    });
    if (activeLayerId === layer.id) {
      const nextActiveLayer =
        scene.layers[Math.max(0, layerIndex - 1)] ??
        scene.layers.find((entry) => entry.id !== layer.id);
      if (nextActiveLayer) {
        setActiveLayer(nextActiveLayer.id);
      }
    }
    setLayerNotice(null);
  };

  const moveLayer = (layerId: string, offset: -1 | 1) => {
    const layerIndex = scene.layers.findIndex((layer) => layer.id === layerId);
    const nextIndex = layerIndex + offset;
    if (layerIndex < 0 || nextIndex < 0 || nextIndex >= scene.layers.length) {
      return;
    }
    updateScene("MOVER CAPA", (nextScene) => {
      const [layer] = nextScene.layers.splice(layerIndex, 1);
      nextScene.layers.splice(nextIndex, 0, layer);
    });
  };

  const toggleLayerVisibility = (layer: Layer) => {
    updateScene(layer.visible ? "OCULTAR CAPA" : "MOSTRAR CAPA", (nextScene) => {
      const target = nextScene.layers.find((entry) => entry.id === layer.id);
      if (target) {
        target.visible = !target.visible;
      }
    });
  };

  const changeLayerEffect = (layer: Layer, effectId: EffectId) => {
    if (layer.effect === effectId) {
      return;
    }
    const defaults =
      EFFECTS.find((entry) => entry.id === effectId)?.defaultControl;
    if (!defaults) {
      return;
    }
    updateScene("CAMBIAR EFECTO", (nextScene) => {
      const target = nextScene.layers.find((entry) => entry.id === layer.id);
      if (target) {
        target.effect = effectId;
        target.params = { ...defaults };
      }
    });
  };

  const handleSave = async () => {
    if (!activeMedia || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    setNeedsSettings(false);
    let temporaryExportUri: string | null = null;

    try {
      let permission = await MediaLibrary.getPermissionsAsync(true);
      if (!permission.granted) {
        permission = await MediaLibrary.requestPermissionsAsync(true);
      }
      if (!permission.granted) {
        setSaveMessage({
          text: "PERMISO DENEGADO · ACTIVA EL ACCESO A FOTOS",
          failed: true,
        });
        setNeedsSettings(true);
        return;
      }

      const exportLayers = scene.layers.map((layer, index) => {
        const currentParams = layerParams.get();
        return {
          ...layer,
          params: {
            x: currentParams[index * 2] ?? layer.params.x,
            y: currentParams[index * 2 + 1] ?? layer.params.y,
          },
        };
      });
      const exported =
        activeMedia.type === "clip"
          ? await exportEffectedFrame({
              sourceImage: currentClip?.currentFrame.get() ?? null,
              layers: exportLayers,
              rotation: currentClip?.rotation ?? 0,
            })
          : await exportEffectedPhoto({
              sourceUri: activeMedia.uri,
              layers: exportLayers,
            });
      temporaryExportUri = exported.uri;
      await MediaLibrary.Asset.create(exported.uri);
      setSaveMessage({
        text:
          activeMedia.type === "clip"
            ? "FOTOGRAMA GUARDADO EN FOTOS"
            : "GUARDADO EN FOTOS",
        failed: false,
      });
      setOpenMenu(null);
    } catch (error) {
      console.error("No se pudo exportar o guardar el resultado.", error);
      setSaveMessage({
        text:
          activeMedia.type === "clip"
            ? "ERROR · NO SE PUDO GUARDAR EL FOTOGRAMA"
            : "ERROR · NO SE PUDO GUARDAR LA FOTO",
        failed: true,
      });
    } finally {
      if (temporaryExportUri) {
        try {
          const temporaryFile = new File(temporaryExportUri);
          if (temporaryFile.exists) {
            temporaryFile.delete();
          }
        } catch (error) {
          console.error("No se pudo limpiar el archivo temporal exportado.", error);
        }
      }
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      {clipUri && !clipLoadError ? (
        <ClipVideoSource
          key={clipUri}
          onLoaded={handleClipLoaded}
          paused={!isFocused}
          uri={clipUri}
        />
      ) : null}
      <View style={styles.canvasFrame}>
        <View
          onLayout={({ nativeEvent: { layout } }) =>
            setCanvasSize({ width: layout.width, height: layout.height })
          }
          style={StyleSheet.absoluteFill}
        >
          {hasImage && shaderTree && drawSize.width > 0 && drawSize.height > 0 && (
            <Canvas style={StyleSheet.absoluteFill}>
              <Rect
                x={imageX}
                y={imageY}
                width={drawSize.width}
                height={drawSize.height}
              >
                {shaderTree}
              </Rect>
            </Canvas>
          )}
        </View>

        {hasImage && drawSize.width > 0 && drawSize.height > 0 ? (
          <>
            <CornerMarks
              style={{
                left: imageX,
                top: imageY,
                width: drawSize.width,
                height: drawSize.height,
              }}
            />
            <GestureDetector gesture={gesture}>
              <Animated.View
                style={[
                  styles.gestureSurface,
                  {
                    left: imageX,
                    top: imageY,
                    width: drawSize.width,
                    height: drawSize.height,
                  },
                ]}
              >
                <Animated.View style={[styles.reticle, reticleStyle]}>
                  <View style={styles.reticleHorizontal} />
                  <View style={styles.reticleVertical} />
                  <View style={styles.reticleCenter} />
                </Animated.View>
                <AnimatedTextInput
                  accessibilityLabel="Lectura de control X y Y"
                  animatedProps={readoutProps}
                  caretHidden
                  editable={false}
                  pointerEvents="none"
                  style={[styles.readout, readoutStyle]}
                />
              </Animated.View>
            </GestureDetector>
          </>
        ) : null}

        {!hasImage && activeMedia ? (
          <View style={styles.loadStatus}>
            <Text style={styles.emptyTitle}>
              {imageLoadError
                ? "ERROR · FOTO NO DISPONIBLE"
                : clipLoadError
                  ? "ERROR · CLIP NO DISPONIBLE"
                  : activeMedia.type === "clip"
                  ? "CARGANDO CLIP"
                  : "CARGANDO FOTO"}
            </Text>
            {imageLoadError ? (
              <Text style={styles.emptyCopy}>VUELVE A CAPTURAR LA IMAGEN</Text>
            ) : null}
            {clipLoadError ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleDiscard}
                style={styles.outlineButton}
              >
                <Text style={styles.outlineButtonText}>VOLVER A CÁMARA</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!activeMedia ? (
          <View style={styles.emptyState}>
            <CornerMarks style={styles.emptyCorners} />
            <Text style={[styles.emptyTitle, { fontSize: type.title * scale }]}>
              SIN IMAGEN
            </Text>
            <Text style={styles.emptyCopy}>TOMA O IMPORTA UNA IMAGEN</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate("/")}
              style={styles.outlineButton}
            >
              <Text style={styles.outlineButtonText}>IR A CÁMARA</Text>
            </Pressable>
          </View>
        ) : null}

        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.chrome,
            { paddingHorizontal: margin, maxWidth: regular ? 1164 : undefined },
            chromeStyle,
          ]}
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel={
                activeMedia?.type === "clip" ? "Descartar clip" : "Descartar foto"
              }
              accessibilityRole="button"
              onPress={handleDiscard}
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonText}>×</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!activeMedia}
              onPress={() => toggleMenu("layers")}
              style={styles.effectTrigger}
            >
              <Text style={styles.effectTriggerText}>
                {activeMedia
                  ? `${String(activeLayerIndex + 1).padStart(2, "0")} · ${activeLayer.effect.toUpperCase()}  ▾`
                  : "CAPAS"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Deshacer${undoState.past.length ? ` ${undoState.past[undoState.past.length - 1].label}` : ""}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: undoState.past.length === 0 }}
              disabled={undoState.past.length === 0}
              onPress={undo}
              style={styles.historyButton}
            >
              <Text
                style={[
                  styles.historyButtonText,
                  undoState.past.length === 0 && styles.historyButtonDisabled,
                ]}
              >
                ↶
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Rehacer${undoState.future.length ? ` ${undoState.future[0].label}` : ""}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: undoState.future.length === 0 }}
              disabled={undoState.future.length === 0}
              onPress={redo}
              style={styles.historyButton}
            >
              <Text
                style={[
                  styles.historyButtonText,
                  undoState.future.length === 0 && styles.historyButtonDisabled,
                ]}
              >
                ↷
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!activeMedia}
              onPress={() => toggleMenu("save")}
              style={styles.saveTrigger}
            >
              <Text style={styles.saveTriggerText}>GUARDAR ▾</Text>
            </Pressable>
          </View>

          {activeMedia ? (
            <View style={styles.dock}>
              <DockItem
                label="CAPAS"
                active={openMenu === "layers"}
                onPress={() => toggleMenu("layers")}
              />
              <DockItem label="MOD" disabled />
              <DockItem label="GESTO" disabled />
              <DockItem label="GIRO" disabled />
              <DockItem label="PRESETS" disabled />
            </View>
          ) : null}

          {openMenu ? (
            <View
              style={[
                styles.menuSheet,
                {
                  left: margin,
                  right: margin,
                  bottom: activeMedia ? 64 : 12,
                  maxHeight: "45%",
                },
              ]}
            >
              <View style={styles.menuHeader}>
                <Text style={styles.menuHeading}>
                  {openMenu === "layers" ? "01  CAPAS" : "05  GUARDAR"}
                </Text>
                <Pressable
                  accessibilityLabel="Cerrar menú"
                  accessibilityRole="button"
                  onPress={() => setOpenMenu(null)}
                  style={styles.closeMenuButton}
                >
                  <Text style={styles.closeMenuText}>×</Text>
                </Pressable>
              </View>
              {openMenu === "layers" ? (
                <ScrollView
                  contentContainerStyle={styles.layersMenuContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.layerCostRow}>
                    <Text style={styles.layerCostLabel}>COSTO ESTIMADO</Text>
                    <Text style={styles.layerCostValue}>{layerCost}×</Text>
                  </View>
                  {layerCost > LAYER_COST_WARNING_THRESHOLD ? (
                    <Text style={styles.layerWarning}>
                      RENDIMIENTO · COSTO ALTO
                    </Text>
                  ) : null}
                  {isPerformanceLow ? (
                    <Text style={styles.layerWarning}>RENDIMIENTO BAJO</Text>
                  ) : null}
                  {scene.layers.length === MAX_LAYER_COUNT ? (
                    <Text style={styles.layerWarning}>
                      TOPE TÉCNICO · {MAX_LAYER_COUNT} CAPAS
                    </Text>
                  ) : null}
                  {scene.layers.map((layer, index) => (
                    <View key={layer.id}>
                      <View style={styles.layerRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: layer.id === activeLayerId,
                          }}
                          onPress={() => setActiveLayer(layer.id)}
                          style={styles.layerSelect}
                        >
                          <Text style={styles.listMarker}>
                            {layer.id === activeLayerId ? "●" : "○"}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.listText,
                              layer.id === activeLayerId && styles.listTextActive,
                              !layer.visible && styles.layerHidden,
                            ]}
                          >
                            CAPA {index + 1} · {layer.effect.toUpperCase()}
                          </Text>
                        </Pressable>
                        <LayerAction
                          label={layer.visible ? "OCULTAR CAPA" : "MOSTRAR CAPA"}
                          onPress={() => toggleLayerVisibility(layer)}
                          symbol={layer.visible ? "◉" : "○"}
                        />
                        <LayerAction
                          disabled={index === 0}
                          label="Mover capa hacia atrás en la pila"
                          onPress={() => moveLayer(layer.id, -1)}
                          symbol="↑"
                        />
                        <LayerAction
                          disabled={index === scene.layers.length - 1}
                          label="Mover capa hacia delante en la pila"
                          onPress={() => moveLayer(layer.id, 1)}
                          symbol="↓"
                        />
                        <LayerAction
                          disabled={scene.layers.length === 1}
                          label="Quitar capa"
                          onPress={() => removeLayer(layer)}
                          symbol="−"
                        />
                      </View>
                      {layer.id === activeLayerId ? (
                        <View style={styles.effectChoices}>
                          {EFFECTS.map((entry) => (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{
                                selected: entry.id === layer.effect,
                              }}
                              key={entry.id}
                              onPress={() => changeLayerEffect(layer, entry.id)}
                              style={[
                                styles.effectChoice,
                                entry.id === layer.effect && styles.effectChoiceActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.effectChoiceText,
                                  entry.id === layer.effect &&
                                    styles.effectChoiceTextActive,
                                ]}
                              >
                                {entry.label.toUpperCase()}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    disabled={scene.layers.length >= MAX_LAYER_COUNT}
                    onPress={addLayer}
                    style={[
                      styles.addLayerButton,
                      scene.layers.length >= MAX_LAYER_COUNT &&
                        styles.addLayerButtonDisabled,
                    ]}
                  >
                    <Text style={styles.addLayerButtonText}>
                      + AÑADIR CAPA · {scene.layers.length}/{MAX_LAYER_COUNT}
                    </Text>
                  </Pressable>
                </ScrollView>
              ) : (
                <View style={styles.saveMenuContent}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!activeMedia || isSaving}
                    onPress={() => void handleSave()}
                    style={styles.saveMenuAction}
                  >
                    <Text style={styles.saveMenuActionText}>
                      {isSaving
                        ? "GUARDANDO…"
                        : activeMedia?.type === "clip"
                          ? "FOTOGRAMA · JPG"
                          : "IMAGEN · JPG"}
                    </Text>
                  </Pressable>
                  <View style={styles.disabledSaveItem}>
                    <Text style={styles.disabledSaveText}>GIF</Text>
                    <Text style={styles.disabledSaveReason}>SIN ANIMACIÓN</Text>
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </Animated.View>
      </View>

      {saveMessage ? (
        <View
          accessibilityRole={saveMessage.failed ? "alert" : "text"}
          style={[
            styles.statusBlock,
            saveMessage.failed ? styles.statusBlockError : styles.statusBlockSuccess,
            { marginHorizontal: margin },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              saveMessage.failed ? styles.statusTextError : styles.statusTextSuccess,
            ]}
          >
            {saveMessage.text}
          </Text>
          {saveMessage.failed && needsSettings ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openSettings()}
              style={styles.statusAction}
            >
              <Text style={styles.statusActionText}>ABRIR AJUSTES</Text>
            </Pressable>
          ) : null}
          {saveMessage.failed && !needsSettings ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void handleSave()}
              style={styles.statusAction}
            >
              <Text style={styles.statusActionText}>REINTENTAR</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {lastChangeLabel ? (
        <View
          pointerEvents="none"
          style={[styles.historyToast, { bottom: isPerformanceLow ? 68 : 16 }]}
        >
          <Text style={styles.historyToastText}>{lastChangeLabel}</Text>
        </View>
      ) : null}
      {layerNotice || isPerformanceLow ? (
        <View style={styles.layerStatus}>
          <Text style={styles.layerStatusText}>
            {layerNotice ?? "RENDIMIENTO BAJO"}
          </Text>
        </View>
      ) : null}

      {isSaving ? <View style={styles.progressLine} /> : null}
    </SafeAreaView>
  );
}

type DockItemProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

function DockItem({ label, active = false, disabled = false, onPress }: DockItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.dockItem, active && styles.dockItemActive]}
    >
      <View style={[styles.dockGlyph, disabled && styles.dockGlyphDisabled]}>
        <View style={styles.glyphLine} />
        {label === "CAPAS" ? <View style={styles.glyphLineSecond} /> : null}
      </View>
      <Text style={[styles.dockLabel, disabled && styles.dockLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

type ClipVideoSourceProps = {
  uri: string;
  paused: boolean;
  onLoaded: (clip: LoadedClip) => void;
};

function ClipVideoSource({ uri, paused, onLoaded }: ClipVideoSourceProps) {
  const pausedValue = useSharedValue(paused);
  const { currentFrame, rotation, size } = useVideo(uri, {
    looping: true,
    paused: pausedValue,
    volume: 0,
  });

  useEffect(() => {
    pausedValue.set(paused);
  }, [paused, pausedValue]);

  useEffect(() => {
    if (size.width > 0 && size.height > 0) {
      onLoaded({
        uri,
        currentFrame,
        width: size.width,
        height: size.height,
        rotation,
      });
    }
  }, [currentFrame, onLoaded, rotation, size.height, size.width, uri]);

  return null;
}

type LayerActionProps = {
  label: string;
  symbol: string;
  disabled?: boolean;
  onPress: () => void;
};

function LayerAction({
  label,
  symbol,
  disabled = false,
  onPress,
}: LayerActionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.layerAction}
    >
      <Text style={[styles.layerActionText, disabled && styles.layerActionDisabled]}>
        {symbol}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.ink,
    flex: 1,
  },
  canvasFrame: {
    backgroundColor: colors.ink,
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  chrome: {
    ...StyleSheet.absoluteFill,
    alignSelf: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    height: 48,
    justifyContent: "space-between",
  },
  headerButton: {
    alignItems: "center",
    height: geometry.target,
    justifyContent: "center",
    width: geometry.target,
  },
  headerButtonText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: 28,
    fontWeight: "200",
  },
  effectTrigger: {
    alignItems: "center",
    flex: 1,
    height: geometry.target,
    justifyContent: "center",
    marginHorizontal: 4,
  },
  effectTriggerText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    fontWeight: "500",
    letterSpacing: 1.1,
    textAlign: "center",
  },
  historyButton: {
    alignItems: "center",
    height: geometry.target,
    justifyContent: "center",
    width: geometry.target,
  },
  historyButtonText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: 22,
    fontWeight: "300",
  },
  historyButtonDisabled: {
    color: colors.inkMute,
    opacity: 0.4,
  },
  saveTrigger: {
    alignItems: "center",
    height: geometry.target,
    justifyContent: "center",
    minWidth: 88,
  },
  saveTriggerText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    fontWeight: "500",
    letterSpacing: 1,
  },
  gestureSurface: {
    position: "absolute",
  },
  reticle: {
    height: RETICLE_SIZE,
    left: 0,
    position: "absolute",
    top: 0,
    width: RETICLE_SIZE,
  },
  reticleHorizontal: {
    backgroundColor: colors.inkText,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: RETICLE_SIZE / 2,
  },
  reticleVertical: {
    backgroundColor: colors.inkText,
    bottom: 0,
    left: RETICLE_SIZE / 2,
    position: "absolute",
    top: 0,
    width: 1,
  },
  reticleCenter: {
    backgroundColor: colors.inkText,
    borderRadius: 3,
    height: 6,
    left: (RETICLE_SIZE - 6) / 2,
    position: "absolute",
    top: (RETICLE_SIZE - 6) / 2,
    width: 6,
  },
  readout: {
    backgroundColor: colors.inkSurface,
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.data,
    fontVariant: ["tabular-nums"],
    height: 22,
    left: 0,
    padding: 0,
    position: "absolute",
    top: 0,
    width: 112,
  },
  loadStatus: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyState: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyCorners: {
    bottom: 24,
    left: 24,
    right: 24,
    top: 24,
  },
  emptyTitle: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.title,
    fontWeight: "300",
    letterSpacing: 0.5,
  },
  emptyCopy: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
    marginTop: 12,
    textAlign: "center",
  },
  outlineButton: {
    alignItems: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 24,
    minHeight: geometry.target,
    minWidth: 164,
  },
  outlineButtonText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    fontWeight: "500",
    letterSpacing: 1.2,
  },
  dock: {
    alignItems: "stretch",
    backgroundColor: colors.inkSurface,
    borderTopColor: colors.inkLine,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    height: 64,
    justifyContent: "space-around",
    marginBottom: 4,
  },
  dockItem: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: geometry.target,
  },
  dockItemActive: {
    backgroundColor: colors.inkText,
  },
  dockGlyph: {
    alignItems: "center",
    borderColor: colors.inkText,
    borderRadius: 2,
    borderWidth: 1,
    height: 15,
    justifyContent: "center",
    marginBottom: 4,
    width: 15,
  },
  dockGlyphDisabled: {
    borderColor: colors.inkMute,
    opacity: 0.55,
  },
  glyphLine: {
    backgroundColor: colors.inkText,
    height: 1,
    width: 9,
  },
  glyphLineSecond: {
    backgroundColor: colors.inkText,
    height: 1,
    marginTop: 3,
    width: 9,
  },
  dockLabel: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.micro,
    fontWeight: "500",
    letterSpacing: 1.1,
  },
  dockLabelDisabled: {
    color: colors.inkMute,
  },
  menuSheet: {
    backgroundColor: colors.inkSurface,
    borderColor: colors.inkLineStrong,
    borderTopWidth: 1,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
  },
  menuHeader: {
    alignItems: "center",
    borderBottomColor: colors.inkLine,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    height: 48,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  menuHeading: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    fontWeight: "500",
    letterSpacing: 1.3,
  },
  closeMenuButton: {
    alignItems: "center",
    height: geometry.target,
    justifyContent: "center",
    width: geometry.target,
  },
  closeMenuText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: 24,
    fontWeight: "200",
  },
  listItem: {
    alignItems: "center",
    borderBottomColor: colors.inkLine,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    height: 48,
    paddingHorizontal: 16,
  },
  listMarker: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    marginRight: 14,
  },
  listText: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
  },
  listTextActive: {
    color: colors.inkText,
    fontWeight: "500",
  },
  layersMenuContent: {
    paddingBottom: 8,
  },
  layerCostRow: {
    alignItems: "center",
    flexDirection: "row",
    height: 40,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  layerCostLabel: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.3,
  },
  layerCostValue: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.data,
    fontVariant: ["tabular-nums"],
  },
  layerWarning: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  layerRow: {
    alignItems: "center",
    borderBottomColor: colors.inkLine,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 4,
  },
  layerSelect: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    minHeight: geometry.target,
    minWidth: 80,
  },
  layerHidden: {
    opacity: 0.5,
  },
  layerAction: {
    alignItems: "center",
    height: geometry.target,
    justifyContent: "center",
    width: geometry.target,
  },
  layerActionText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: 17,
  },
  layerActionDisabled: {
    color: colors.inkMute,
    opacity: 0.4,
  },
  effectChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  effectChoice: {
    alignItems: "center",
    borderColor: colors.inkLine,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: geometry.target,
    paddingHorizontal: 8,
  },
  effectChoiceActive: {
    backgroundColor: colors.inkText,
    borderColor: colors.inkText,
  },
  effectChoiceText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 0.7,
  },
  effectChoiceTextActive: {
    color: colors.ink,
  },
  addLayerButton: {
    alignItems: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: 1,
    justifyContent: "center",
    marginHorizontal: 12,
    marginTop: 8,
    minHeight: geometry.target,
  },
  addLayerButtonDisabled: {
    opacity: 0.45,
  },
  addLayerButtonText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.1,
  },
  saveMenuContent: {
    padding: 16,
  },
  saveMenuAction: {
    alignItems: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: geometry.target,
  },
  saveMenuActionText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    fontWeight: "500",
    letterSpacing: 1.2,
  },
  disabledSaveItem: {
    alignItems: "center",
    flexDirection: "row",
    height: 44,
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  disabledSaveText: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
  },
  disabledSaveReason: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.2,
  },
  statusBlock: {
    alignItems: "center",
    borderWidth: 1,
    bottom: 8,
    left: 0,
    padding: 12,
    position: "absolute",
    right: 0,
    zIndex: 2,
  },
  statusBlockError: {
    backgroundColor: colors.inkText,
    borderColor: colors.inkText,
  },
  statusBlockSuccess: {
    backgroundColor: colors.inkSurface,
    borderColor: colors.inkLineStrong,
  },
  statusText: {
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.1,
    textAlign: "center",
  },
  statusTextError: {
    color: colors.ink,
  },
  statusTextSuccess: {
    color: colors.inkText,
  },
  statusAction: {
    alignItems: "center",
    borderColor: colors.ink,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 8,
    minHeight: geometry.target,
    minWidth: 140,
  },
  statusActionText: {
    color: colors.ink,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
  },
  historyToast: {
    alignSelf: "center",
    backgroundColor: colors.inkSurface,
    borderColor: colors.inkLineStrong,
    borderWidth: 1,
    maxWidth: "90%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: "absolute",
    zIndex: 2,
  },
  historyToastText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.1,
    textAlign: "center",
  },
  layerStatus: {
    alignSelf: "center",
    backgroundColor: colors.inkText,
    bottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute",
    zIndex: 3,
  },
  layerStatusText: {
    color: colors.ink,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.1,
  },
  progressLine: {
    backgroundColor: colors.inkText,
    height: 1,
    left: 0,
    position: "absolute",
    top: 0,
    width: "34%",
  },
});

function getContainSize(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
) {
  if (imageWidth <= 0 || imageHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale };
}
