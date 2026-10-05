import {
    Canvas,
    ImageShader,
    Rect,
    Shader,
    Skia,
    useImage,
} from "@shopify/react-native-skia";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { chromaticShader } from "../effects/chromatic.sksl";

const chromaticEffect = Skia.RuntimeEffect.Make(chromaticShader);

export default function EditorRoute() {
  const { uri, width, height } = useLocalSearchParams<{
    uri?: string;
    width?: string;
    height?: string;
  }>();
  const photoUri = typeof uri === "string" ? uri : "";
  const image = useImage(photoUri);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const amount = useSharedValue(0.015);
  const angle = useSharedValue(Math.PI / 4);
  const drawSize = image
    ? getContainSize(image.width(), image.height(), canvasSize.width, canvasSize.height)
    : { width: 0, height: 0 };
  const imageX = (canvasSize.width - drawSize.width) / 2;
  const imageY = (canvasSize.height - drawSize.height) / 2;
  const uniforms = useDerivedValue(() => ({
    resolution: [drawSize.width, drawSize.height],
    amount: amount.value,
    angle: angle.value,
  }));

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
      <View
        onLayout={({ nativeEvent: { layout } }) =>
          setCanvasSize({ width: layout.width, height: layout.height })
        }
        style={styles.imageFrame}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          {image && chromaticEffect && drawSize.width > 0 && drawSize.height > 0 && (
            <Rect
              x={imageX}
              y={imageY}
              width={drawSize.width}
              height={drawSize.height}
            >
              <Shader source={chromaticEffect} uniforms={uniforms}>
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
  imageFrame: {
    alignItems: "center",
    backgroundColor: "#1b251f",
    flex: 1,
    justifyContent: "center",
    marginVertical: 12,
    overflow: "hidden",
    position: "relative",
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