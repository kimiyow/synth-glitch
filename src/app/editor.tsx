import {
  Canvas,
  ImageShader,
  Rect,
  Shader,
  Skia,
} from "@shopify/react-native-skia";
import * as MediaLibrary from "expo-media-library";
import { File } from "expo-file-system";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  DEFAULT_EFFECT_ID,
  EFFECTS,
  type EffectId,
} from "../effects/registry";
import { exportEffectedPhoto } from "../editor/exportImage";
import { useEditorStore } from "../state/editorStore";

const RETICLE_SIZE = 30;

export default function EditorRoute() {
  const activeMedia = useEditorStore((state) => state.activeMedia);
  const clearActiveMedia = useEditorStore((state) => state.clearActiveMedia);
  const photoUri = activeMedia?.uri ?? null;
  const [loadedPhoto, setLoadedPhoto] = useState<{
    uri: string;
    image: NonNullable<ReturnType<typeof Skia.Image.MakeImageFromEncoded>> | null;
    failed: boolean;
  } | null>(null);
  const currentPhoto = loadedPhoto?.uri === photoUri ? loadedPhoto : null;
  const image = currentPhoto?.image ?? null;
  const imageLoadError = currentPhoto?.failed ?? false;
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [activeEffectId, setActiveEffectId] = useState<EffectId>(DEFAULT_EFFECT_ID);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);
  const activeEffect = EFFECTS.find((effect) => effect.id === activeEffectId) ?? EFFECTS[0];
  const effect = Skia.RuntimeEffect.Make(activeEffect.shader);
  const controlX = useSharedValue(activeEffect.defaultControl.x);
  const controlY = useSharedValue(activeEffect.defaultControl.y);
  const reticleOpacity = useSharedValue(0);
  const clock = useSharedValue(0);

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

  useEffect(() => {
    controlX.set(activeEffect.defaultControl.x);
    controlY.set(activeEffect.defaultControl.y);
    reticleOpacity.set(withTiming(1, { duration: 80 }));
  }, [activeEffect.defaultControl.x, activeEffect.defaultControl.y, controlX, controlY, reticleOpacity]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      clock.set(clock.get() + 0.016);
    }, 16);

    return () => clearInterval(intervalId);
  }, [clock]);

  const drawSize = image
    ? getContainSize(image.width(), image.height(), canvasSize.width, canvasSize.height)
    : { width: 0, height: 0 };
  const imageX = (canvasSize.width - drawSize.width) / 2;
  const imageY = (canvasSize.height - drawSize.height) / 2;
  const uniforms = useDerivedValue(() => ({
    resolution: [drawSize.width, drawSize.height],
    param: [controlX.get(), controlY.get()],
    time: clock.get(),
  }));
  const reticleStyle = useAnimatedStyle(() => ({
    opacity: reticleOpacity.get(),
    transform: [
      { translateX: controlX.get() * drawSize.width - RETICLE_SIZE / 2 },
      { translateY: controlY.get() * drawSize.height - RETICLE_SIZE / 2 },
    ],
  }));

  const panGesture = Gesture.Pan()
    .minDistance(4)
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      reticleOpacity.set(withTiming(1, { duration: 80 }));
    })
    .onUpdate((event) => {
      if (event.numberOfPointers !== 1) {
        return;
      }
      controlX.set(Math.min(Math.max(event.x / drawSize.width, 0), 1));
      controlY.set(Math.min(Math.max(event.y / drawSize.height, 0), 1));
    })
    .onFinalize((_event, success) => {
      if (success) {
        reticleOpacity.set(withDelay(850, withTiming(0, { duration: 220 })));
      }
    });

  const resetGesture = Gesture.Tap()
    .numberOfTaps(2)
    .minPointers(1)
    .maxDistance(3)
    .onEnd((_event, success) => {
      if (!success) {
        return;
      }
      controlX.set(activeEffect.defaultControl.x);
      controlY.set(activeEffect.defaultControl.y);
      reticleOpacity.set(
        withSequence(
          withTiming(1, { duration: 80 }),
          withDelay(850, withTiming(0, { duration: 220 })),
        ),
      );
    });

  const gesture = Gesture.Simultaneous(panGesture, resetGesture);

  const handleDiscard = () => {
    clearActiveMedia();
    setSaveMessage(null);
    setNeedsSettings(false);
    router.navigate("/");
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
        setSaveMessage(
          "No se concedió permiso para guardar en Fotos. Puedes habilitarlo en Ajustes y volver a intentarlo.",
        );
        setNeedsSettings(true);
        return;
      }

      const exported = await exportEffectedPhoto({
        sourceUri: activeMedia.uri,
        effectId: activeEffectId,
        controlX: controlX.get(),
        controlY: controlY.get(),
      });
      temporaryExportUri = exported.uri;

      await MediaLibrary.Asset.create(exported.uri);
      setSaveMessage("Foto guardada en Fotos.");
    } catch (error) {
      console.error("No se pudo exportar o guardar la foto.", error);
      setSaveMessage("No se pudo guardar la foto. El editor conserva la imagen para reintentar.");
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
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Descartar foto y volver a la cámara"
          accessibilityRole="button"
          onPress={handleDiscard}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </Pressable>

        <Text style={styles.title}>
          {activeMedia ? "Foto capturada" : "Editor"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.effectSelector}>
        {EFFECTS.map((effectEntry) => (
          <Pressable
            accessibilityRole="button"
            key={effectEntry.id}
            onPress={() => setActiveEffectId(effectEntry.id)}
            style={[
              styles.effectButton,
              activeEffectId === effectEntry.id && styles.effectButtonActive,
            ]}
          >
            <Text
              style={[
                styles.effectButtonText,
                activeEffectId === effectEntry.id && styles.effectButtonTextActive,
              ]}
            >
              {effectEntry.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View
        onLayout={({ nativeEvent: { layout } }) =>
          setCanvasSize({ width: layout.width, height: layout.height })
        }
        style={styles.imageFrame}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          {image && effect && drawSize.width > 0 && drawSize.height > 0 && (
            <Rect
              x={imageX}
              y={imageY}
              width={drawSize.width}
              height={drawSize.height}
            >
              <Shader source={effect} uniforms={uniforms}>
                <ImageShader
                  image={image}
                  fit="contain"
                  rect={{
                    x: imageX,
                    y: imageY,
                    width: drawSize.width,
                    height: drawSize.height,
                  }}
                />
              </Shader>
            </Rect>
          )}
        </Canvas>

        {image && effect && drawSize.width > 0 && drawSize.height > 0 && (
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
              <Animated.View
                pointerEvents="none"
                style={[styles.reticle, reticleStyle]}
              >
                <View style={styles.reticleRing} />
                <View style={styles.reticleHorizontal} />
                <View style={styles.reticleVertical} />
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        )}

        {!image && activeMedia && (
          <Text style={styles.loading}>
            {imageLoadError
              ? "No se pudo cargar la foto. Vuelve a capturarla e inténtalo de nuevo."
              : "Cargando foto..."}
          </Text>
        )}
      </View>

      {activeMedia ? (
        <Text style={styles.dimensions}>
          {activeMedia.width} × {activeMedia.height} px
        </Text>
      ) : (
        <View style={styles.headerSpacer} />
      )}

      {activeMedia ? (
        <View style={styles.saveActions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => void handleSave()}
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? "Guardando..." : "Guardar en Fotos"}
            </Text>
          </Pressable>
          {saveMessage ? (
            <Text style={styles.saveMessage}>{saveMessage}</Text>
          ) : null}
          {needsSettings ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openSettings()}
              style={styles.settingsButton}
            >
              <Text style={styles.settingsButtonText}>Abrir Ajustes</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No hay una foto para editar</Text>
          <Text style={styles.emptyMessage}>
            Ve a Cámara y captura una foto para empezar.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate("/")}
            style={styles.cameraButton}
          >
            <Text style={styles.cameraButtonText}>Ir a Cámara</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#101512",
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
  },
  backButton: {
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
  },
  backButtonText: {
    color: "#c9f36a",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    color: "#f1f5ee",
    fontSize: 17,
    fontWeight: "700",
  },
  headerSpacer: {
    minWidth: 72,
  },
  effectSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  effectButton: {
    backgroundColor: "#1b251f",
    borderColor: "#2d3a32",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  effectButtonActive: {
    backgroundColor: "#c9f36a",
    borderColor: "#c9f36a",
  },
  effectButtonText: {
    color: "#f1f5ee",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  effectButtonTextActive: {
    color: "#101512",
  },
  imageFrame: {
    alignItems: "center",
    backgroundColor: "#1b251f",
    flex: 1,
    justifyContent: "center",
    marginVertical: 12,
    overflow: "hidden",
    position: "relative",
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
  reticleRing: {
    borderColor: "#c9f36a",
    borderRadius: RETICLE_SIZE / 2,
    borderWidth: 1,
    height: 20,
    left: (RETICLE_SIZE - 20) / 2,
    position: "absolute",
    top: (RETICLE_SIZE - 20) / 2,
    width: 20,
  },
  reticleHorizontal: {
    backgroundColor: "#c9f36a",
    height: 1,
    left: 1,
    position: "absolute",
    right: 1,
    top: (RETICLE_SIZE - 1) / 2,
  },
  reticleVertical: {
    backgroundColor: "#c9f36a",
    bottom: 1,
    left: (RETICLE_SIZE - 1) / 2,
    position: "absolute",
    top: 1,
    width: 1,
  },
  loading: {
    color: "#b7c1ba",
    fontSize: 15,
    position: "absolute",
    textAlign: "center",
  },
  dimensions: {
    color: "#b7c1ba",
    fontSize: 13,
    textAlign: "center",
  },
  saveActions: {
    gap: 10,
    paddingTop: 12,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#c9f36a",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: "#101512",
    fontSize: 16,
    fontWeight: "700",
  },
  saveMessage: {
    color: "#f1f5ee",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  settingsButton: {
    alignItems: "center",
    borderColor: "#67726b",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  settingsButtonText: {
    color: "#f1f5ee",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    paddingTop: 16,
  },
  emptyTitle: {
    color: "#f1f5ee",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyMessage: {
    color: "#b7c1ba",
    fontSize: 14,
    textAlign: "center",
  },
  cameraButton: {
    alignItems: "center",
    backgroundColor: "#c9f36a",
    borderRadius: 10,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 20,
  },
  cameraButtonText: {
    color: "#101512",
    fontSize: 14,
    fontWeight: "700",
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