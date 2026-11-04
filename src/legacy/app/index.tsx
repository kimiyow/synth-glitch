import { CameraView, useCameraPermissions } from "expo-camera";
import { File } from "expo-file-system";
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
import { activateMedia } from "../media/activateMedia";
import { pickMediaFromLibrary } from "../media/pickMedia";
import { CornerMarks } from "../ui/CornerMarks";
import { colors, geometry, type } from "../ui/tokens";
import { useLayout } from "../ui/useLayout";

const MIN_CLIP_DURATION_SECONDS = 1;
const MAX_CLIP_DURATION_SECONDS = 5;

export default function HomeScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
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
  const [isImporting, setIsImporting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [captureMode, setCaptureMode] = useState<"photo" | "clip">("photo");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [viewfinderArea, setViewfinderArea] = useState({ width: 0, height: 0 });
  const recordingInProgress = useRef(false);
  const recordingDurationRef = useRef(0);
  const isFocusedRef = useRef(isFocused);

  useEffect(() => {
    if (cameraPermission?.status === "undetermined") {
      void requestCameraPermission();
    }
  }, [cameraPermission?.status, requestCameraPermission]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused && recordingInProgress.current) {
      cameraRef.current?.stopRecording();
    }
  }, [isFocused]);

  const importMedia = async () => {
    if (isImporting || isCapturing || isRecording) {
      return;
    }

    setIsImporting(true);
    setCameraError(null);
    try {
      const result = await pickMediaFromLibrary();
      if (result.kind === "cancelled") {
        return;
      }
      if (result.kind === "rejected") {
        setCameraError(result.message);
        return;
      }

      activateMedia(result.media);
      router.navigate("/editor");
    } catch (error) {
      console.error("No se pudo importar contenido desde Fotos.", error);
      setCameraError("ERROR · NO SE PUDO IMPORTAR. REINTENTA.");
    } finally {
      setIsImporting(false);
    }
  };

  if (!cameraPermission) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.permissionLabel}>SYNTHVJ / ACCESO</Text>
        <Text style={styles.permissionTitle}>CÁMARA</Text>
        <Text style={styles.permissionCopy}>
          Necesitamos usar la cámara para capturar imágenes y crear efectos.
        </Text>
        {cameraError ? (
          <Text accessibilityRole="alert" style={styles.permissionError}>
            {cameraError}
          </Text>
        ) : null}
        {cameraError?.startsWith("PERMISO DENEGADO") ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={styles.paperOutlineButton}
          >
            <Text style={styles.paperOutlineButtonText}>ABRIR AJUSTES</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => void requestCameraPermission()}
          style={styles.paperButton}
        >
          <Text style={styles.paperButtonText}>PERMITIR</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isImporting}
          onPress={() => void importMedia()}
          style={styles.paperOutlineButton}
        >
          <Text style={styles.paperOutlineButtonText}>
            {isImporting ? "ABRIENDO FOTOS…" : "IMPORTAR DESDE FOTOS"}
          </Text>
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
        {cameraError ? (
          <Text accessibilityRole="alert" style={styles.permissionError}>
            {cameraError}
          </Text>
        ) : null}
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
        <Pressable
          accessibilityRole="button"
          disabled={isImporting}
          onPress={() => void importMedia()}
          style={styles.paperOutlineButton}
        >
          <Text style={styles.paperOutlineButtonText}>
            {isImporting ? "ABRIENDO FOTOS…" : "IMPORTAR DESDE FOTOS"}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const capturePhoto = async () => {
    if (!cameraRef.current || !isCameraReady || isCapturing || isRecording) {
      return;
    }

    setIsCapturing(true);
    setCameraError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      activateMedia({
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

  const recordClip = async () => {
    if (
      !cameraRef.current ||
      !isCameraReady ||
      isCapturing ||
      recordingInProgress.current
    ) {
      return;
    }

    recordingInProgress.current = true;
    setIsCapturing(true);
    setIsRecording(true);
    setRecordingDuration(0);
    setCameraError(null);

    try {
      const clip = await cameraRef.current.recordAsync({
        maxDuration: MAX_CLIP_DURATION_SECONDS,
        progressUpdateInterval: 0.1,
      });
      if (!isFocusedRef.current) {
        try {
          if (clip?.uri) {
            const abandonedFile = new File(clip.uri);
            if (abandonedFile.exists) {
              abandonedFile.delete();
            }
          }
        } catch (error) {
          console.error("No se pudo limpiar el clip de una grabación cancelada.", error);
        }
        return;
      }

      if (!clip?.uri) {
        throw new Error("La cámara no devolvió un archivo de video.");
      }

      if (recordingDurationRef.current < MIN_CLIP_DURATION_SECONDS) {
        try {
          const incompleteFile = new File(clip.uri);
          if (incompleteFile.exists) {
            incompleteFile.delete();
          }
        } catch (error) {
          console.error("No se pudo limpiar el clip demasiado corto.", error);
        }
        setCameraError("CLIP DEMASIADO CORTO · GRABA AL MENOS 1 S.");
        return;
      }

      activateMedia({
        uri: clip.uri,
        type: "clip",
        width: 0,
        height: 0,
      });
      router.navigate("/editor");
    } catch (error) {
      console.error("No se pudo grabar el clip.", error);
      setCameraError("ERROR · NO SE PUDO GRABAR. REINTENTA.");
    } finally {
      recordingInProgress.current = false;
      setIsRecording(false);
      setIsCapturing(false);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
    }
  };

  const stopRecording = () => {
    if (
      !recordingInProgress.current ||
      recordingDurationRef.current < MIN_CLIP_DURATION_SECONDS
    ) {
      return;
    }
    cameraRef.current?.stopRecording();
  };

  const capture = () => {
    if (captureMode === "photo") {
      void capturePhoto();
    } else if (isRecording) {
      stopRecording();
    } else {
      void recordClip();
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
                mode={captureMode === "photo" ? "picture" : "video"}
                mute
                onRecordingProgress={(event) => {
                  const duration = Math.min(
                    event.duration,
                    MAX_CLIP_DURATION_SECONDS,
                  );
                  recordingDurationRef.current = duration;
                  setRecordingDuration(duration);
                }}
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
            {(["photo", "clip"] as const).map((mode) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{
                  selected: captureMode === mode,
                  disabled: isRecording || isCapturing || isImporting,
                }}
                disabled={isRecording || isCapturing || isImporting}
                key={mode}
                onPress={() => setCaptureMode(mode)}
                style={styles.modeItem}
              >
                <Text
                  style={captureMode === mode ? styles.modeActive : styles.modeDisabled}
                >
                  {mode === "photo" ? "FOTO" : "CLIP"}
                </Text>
                {captureMode === mode ? <View style={styles.modeUnderline} /> : null}
              </Pressable>
            ))}
          </View>

          {isRecording ? (
            <Text accessibilityLiveRegion="polite" style={styles.recordingStatus}>
              GRABANDO · {recordingDuration.toFixed(1)} / {MAX_CLIP_DURATION_SECONDS} S
            </Text>
          ) : null}

          {cameraError ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>{cameraError}</Text>
              {cameraError.startsWith("PERMISO DENEGADO") ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void Linking.openSettings()}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>ABRIR AJUSTES</Text>
                </Pressable>
              ) : null}
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
            accessibilityLabel={
              captureMode === "photo"
                ? "Capturar foto"
                : isRecording
                  ? "Detener grabación"
                  : "Grabar clip"
            }
            accessibilityRole="button"
            disabled={
              isImporting ||
              !isCameraReady ||
              (isCapturing &&
                (!isRecording ||
                  recordingDuration < MIN_CLIP_DURATION_SECONDS))
            }
            onPress={capture}
            style={[
              styles.shutterOuter,
              (!isCameraReady ||
                (isCapturing &&
                  (!isRecording ||
                    recordingDuration < MIN_CLIP_DURATION_SECONDS))) &&
                styles.disabledControl,
              isRecording && styles.recordingShutter,
            ]}
          >
            <View
              style={[
                styles.shutterInner,
                isRecording && styles.recordingShutterInner,
              ]}
            />
          </Pressable>
          <Text style={styles.captureHint}>
            {captureMode === "photo"
              ? isCapturing
                ? "CAPTURANDO…"
                : "TOCA PARA CAPTURAR"
              : isRecording
                ? recordingDuration < MIN_CLIP_DURATION_SECONDS
                  ? "ESPERA 1 S"
                  : "TOCA PARA DETENER"
                : "TOCA PARA GRABAR · MÁX. 5 S"}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isImporting || isCapturing || isRecording}
            onPress={() => void importMedia()}
            style={styles.galleryButton}
          >
            <Text style={styles.galleryButtonText}>
              {isImporting ? "ABRIENDO FOTOS…" : "IMPORTAR FOTO O VIDEO"}
            </Text>
          </Pressable>
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
  permissionError: {
    color: colors.paperText,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 0.6,
    marginBottom: 16,
    textAlign: "center",
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
  recordingStatus: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.data,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.8,
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
  recordingShutter: {
    borderRadius: 16,
  },
  recordingShutterInner: {
    borderRadius: 4,
    height: 24,
    width: 24,
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
  galleryButton: {
    alignItems: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: geometry.target,
    minWidth: 192,
    paddingHorizontal: 16,
  },
  galleryButtonText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.2,
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
