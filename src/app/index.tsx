import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useIsFocused } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CornerMarks } from "../ui/CornerMarks";
import { colors, geometry, type } from "../ui/tokens";
import { useLayout } from "../ui/useLayout";
import { useEditorStore } from "../state/editorStore";

export default function HomeScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const setActiveMedia = useEditorStore((state) => state.setActiveMedia);
  const isFocused = useIsFocused();
  const { margin, regular, scale } = useLayout();
  const cameraInstance = useMemo(
    () => (isFocused ? Symbol("camera-instance") : null),
    [isFocused],
  );
  const [readyCameraInstance, setReadyCameraInstance] = useState<symbol | null>(
    null,
  );
  const isCameraReady =
    cameraInstance !== null && readyCameraInstance === cameraInstance;
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [viewfinderArea, setViewfinderArea] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (cameraPermission?.status === "undetermined") {
      void requestCameraPermission();
    }
  }, [cameraPermission?.status, requestCameraPermission]);

  if (!cameraPermission) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.permissionLabel}>SYNTHVJ / ACCESO</Text>
        <Text style={styles.permissionTitle}>CÁMARA</Text>
        <Text style={styles.permissionCopy}>
          Necesitamos usar la cámara para capturar imágenes y crear efectos.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void requestCameraPermission()}
          style={styles.paperButton}
        >
          <Text style={styles.paperButtonText}>PERMITIR</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.permissionLabel}>SYNTHVJ / ACCESO</Text>
        <Text style={styles.permissionTitle}>CÁMARA</Text>
        <Text style={styles.permissionCopy}>
          Activa el acceso a la cámara para capturar imágenes.
        </Text>
        {cameraPermission.canAskAgain && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestCameraPermission()}
            style={styles.paperButton}
          >
            <Text style={styles.paperButtonText}>PERMITIR</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openSettings()}
          style={styles.paperOutlineButton}
        >
          <Text style={styles.paperOutlineButtonText}>ABRIR AJUSTES</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const capturePhoto = async () => {
    if (!cameraRef.current || !isCameraReady || isCapturing) {
      return;
    }

    setIsCapturing(true);
    setCameraError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      setActiveMedia({
        uri: photo.uri,
        type: "photo",
        width: photo.width,
        height: photo.height,
      });
      router.navigate("/editor");
    } catch (error) {
      console.error("No se pudo capturar la foto.", error);
      setCameraError("ERROR · NO SE PUDO CAPTURAR. REINTENTA.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View
        style={[
          styles.cameraContent,
          {
            paddingHorizontal: margin,
            maxWidth: regular ? 1164 : undefined,
            alignSelf: "center",
          },
        ]}
      >
        <View style={styles.cameraHeader}>
          <View style={styles.brandMark}>
            <Text style={[styles.wordmark, { fontSize: 12 * scale }]}>
              SYNTHVJ
            </Text>
            <Text style={styles.headerCaption}>CÁMARA</Text>
          </View>
          <Text style={styles.ratio}>4:3</Text>
        </View>

        <View
          onLayout={({ nativeEvent: { layout } }) =>
            setViewfinderArea({ width: layout.width, height: layout.height })
          }
          style={styles.viewfinderArea}
        >
          <View
            style={[
              styles.viewfinder,
              {
                width: Math.min(
                  viewfinderArea.width,
                  viewfinderArea.height * (4 / 3),
                  regular ? 1100 : Number.POSITIVE_INFINITY,
                ),
              },
            ]}
          >
            {isFocused && (
              <CameraView
                ref={cameraRef}
                active
                facing="back"
                mode="picture"
                onCameraReady={() => {
                  if (cameraInstance) {
                    setReadyCameraInstance(cameraInstance);
                  }
                }}
                onMountError={(event) =>
                  setCameraError(`ERROR · CÁMARA · ${event.message}`)
                }
                style={styles.camera}
              />
            )}
            <CornerMarks />
            {!isCameraReady && (
              <View pointerEvents="none" style={styles.cameraLoading}>
                <Text style={styles.dataText}>INICIALIZANDO VISOR</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.capturePanel}>
          <View
            accessibilityRole="tablist"
            style={styles.modeSelector}
          >
            <View accessibilityState={{ selected: true }} style={styles.modeItem}>
              <Text style={styles.modeActive}>FOTO</Text>
              <View style={styles.modeUnderline} />
            </View>
            <View
              accessibilityLabel="Clip; disponible en la fase 6"
              accessibilityRole="tab"
              accessibilityState={{ disabled: true }}
              style={styles.modeItem}
            >
              <Text style={styles.modeDisabled}>CLIP</Text>
            </View>
          </View>

          {cameraError ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>{cameraError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCameraError(null)}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>CERRAR</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Capturar foto"
            accessibilityRole="button"
            disabled={!isCameraReady || isCapturing}
            onPress={() => void capturePhoto()}
            style={[
              styles.shutterOuter,
              (!isCameraReady || isCapturing) && styles.disabledControl,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Text style={styles.captureHint}>
            {isCapturing ? "CAPTURANDO…" : "TOCA PARA CAPTURAR"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.ink,
    flex: 1,
  },
  permissionScreen: {
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: "center",
    padding: 32,
  },
  permissionLabel: {
    color: colors.paperMute,
    fontFamily: type.family,
    fontSize: type.label,
    fontWeight: "500",
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  permissionTitle: {
    color: colors.paperText,
    fontFamily: type.family,
    fontSize: type.title,
    fontWeight: "300",
    marginBottom: 8,
  },
  permissionCopy: {
    color: colors.paperMute,
    fontFamily: type.family,
    fontSize: type.body,
    lineHeight: 22,
    marginBottom: 24,
  },
  paperButton: {
    alignItems: "center",
    backgroundColor: colors.paperText,
    justifyContent: "center",
    minHeight: geometry.target,
    paddingHorizontal: 20,
  },
  paperButtonText: {
    color: colors.paper,
    fontFamily: type.family,
    fontSize: type.label,
    fontWeight: "500",
    letterSpacing: 1.2,
  },
  paperOutlineButton: {
    alignItems: "center",
    borderColor: colors.paperLine,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 12,
    minHeight: geometry.target,
  },
  paperOutlineButtonText: {
    color: colors.paperText,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
  },
  cameraContent: {
    flex: 1,
    width: "100%",
  },
  cameraHeader: {
    alignItems: "center",
    flexDirection: "row",
    height: 44,
    justifyContent: "space-between",
  },
  brandMark: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  wordmark: {
    color: colors.inkText,
    fontFamily: type.family,
    fontWeight: "500",
    letterSpacing: 1.5,
  },
  headerCaption: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.5,
    paddingTop: 2,
  },
  ratio: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.data,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.5,
  },
  viewfinderArea: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 0,
  },
  viewfinder: {
    aspectRatio: 4 / 3,
    backgroundColor: "#111111",
    overflow: "hidden",
    position: "relative",
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  cameraLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  dataText: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.data,
    letterSpacing: 0.8,
  },
  capturePanel: {
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  modeSelector: {
    alignItems: "center",
    flexDirection: "row",
    gap: 28,
    height: 36,
    justifyContent: "center",
  },
  modeItem: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    minWidth: 44,
  },
  modeActive: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    fontWeight: "500",
    letterSpacing: 1.2,
  },
  modeDisabled: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
    opacity: 0.5,
  },
  modeUnderline: {
    backgroundColor: colors.inkText,
    height: 1,
    marginTop: 5,
    width: 24,
  },
  shutterOuter: {
    alignItems: "center",
    borderColor: colors.inkText,
    borderRadius: 40,
    borderWidth: 2,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  shutterInner: {
    backgroundColor: colors.inkText,
    borderRadius: 30,
    height: 56,
    width: 56,
  },
  disabledControl: {
    opacity: 0.35,
  },
  captureHint: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.5,
    minHeight: 12,
  },
  errorBlock: {
    alignItems: "center",
    backgroundColor: colors.inkText,
    gap: 8,
    padding: 12,
    width: "100%",
  },
  errorText: {
    color: colors.ink,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    borderColor: colors.ink,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 96,
  },
  retryText: {
    color: colors.ink,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
  },
});
