import { Canvas, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EditorRoute() {
  const { uri, width, height } = useLocalSearchParams<{
    uri?: string;
    width?: string;
    height?: string;
  }>();
  const photoUri = typeof uri === "string" ? uri : "";
  const image = useImage(photoUri);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

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
          {image && canvasSize.width > 0 && canvasSize.height > 0 && (
            <SkiaImage
              fit="contain"
              image={image}
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
            />
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