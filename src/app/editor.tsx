import {
  Canvas,
  ImageShader,
  Rect,
  Shader,
  Skia,
  useImage,
} from "@shopify/react-native-skia";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
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

const RETICLE_SIZE = 30;

export default function EditorRoute() {
  const { uri, width, height } = useLocalSearchParams<{
    uri?: string;
    width?: string;
    height?: string;
  }>();
  const photoUri = typeof uri === "string" ? uri : "";
  const image = useImage(photoUri);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [activeEffectId, setActiveEffectId] = useState<EffectId>(DEFAULT_EFFECT_ID);
  const activeEffect = EFFECTS.find((effect) => effect.id === activeEffectId) ?? EFFECTS[0];
  const effect = Skia.RuntimeEffect.Make(activeEffect.shader);
  const controlX = useSharedValue(activeEffect.defaultControl.x);
  const controlY = useSharedValue(activeEffect.defaultControl.y);
  const reticleOpacity = useSharedValue(0);
  const clock = useSharedValue(0);

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

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Descartar foto y volver a la cámara"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </Pressable>

        <Text style={styles.title}>Foto capturada</Text>
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

        {!image && (
          <Text style={styles.loading}>
            {photoUri ? "Cargando foto..." : "No se recibió la foto capturada."}
          </Text>
        )}
      </View>

      {width && height ? (
        <Text style={styles.dimensions}>{width} × {height} px</Text>
      ) : (
        <View style={styles.headerSpacer} />
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