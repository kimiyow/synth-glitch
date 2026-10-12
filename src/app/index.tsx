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
import { useEditorStore } from "../state/editorStore";

export default function HomeScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const setActiveMedia = useEditorStore((state) => state.setActiveMedia);
  const isFocused = useIsFocused();
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

  useEffect(() => {
    if (cameraPermission?.status === "undetermined") {
      void requestCameraPermission();
    }
  }, [cameraPermission?.status, requestCameraPermission]);

  if (!cameraPermission) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.message}>Solicitando permisos...</Text>
      </SafeAreaView>
    );
  }

  const missingPermissions = [
    cameraPermission.granted ? null : "la cámara",
  ].filter((permission): permission is string => permission !== null);

  if (missingPermissions.length > 0) {
    const canAskAgain = !cameraPermission.granted && cameraPermission.canAskAgain;

    const retryPermissions = async () => {
      if (!cameraPermission.granted && cameraPermission.canAskAgain) {
        await requestCameraPermission();
      }
    };

    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>SYNTHVJ / ACCESO</Text>
          <Text style={styles.title}>Permisos necesarios</Text>
          <Text style={styles.message}>
            Para continuar, activa {missingPermissions.join(" y ")}.
          </Text>
        </View>
        <View style={styles.actions}>
          {canAskAgain && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void retryPermissions()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Volver a solicitar</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Abrir Ajustes</Text>
          </Pressable>
        </View>
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
    } catch {
      setCameraError("No se pudo capturar la foto. Inténtalo de nuevo.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.cameraScreen}>
      <StatusBar barStyle="light-content" />
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
            setCameraError(`No se pudo iniciar la cámara: ${event.message}`)
          }
          style={styles.camera}
        />
      )}
      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>SYNTHVJ</Text>
          <Text style={styles.modeLabel}>CÁMARA</Text>
        </View>
        <View style={styles.bottomBar}>
          {cameraError && <Text style={styles.errorMessage}>{cameraError}</Text>}
          <Pressable
            accessibilityLabel="Capturar foto"
            accessibilityRole="button"
            disabled={!isCameraReady || isCapturing}
            onPress={() => void capturePhoto()}
            style={[
              styles.captureButton,
              (!isCameraReady || isCapturing) && styles.captureButtonDisabled,
            ]}
          >
            <View style={styles.captureButtonInner} />
          </Pressable>
          <Text style={styles.caption}>
            {isCapturing ? "Capturando..." : "Toca para capturar"}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraScreen: {
    flex: 1,
    backgroundColor: "#101512",
  },
  eyebrow: {
    color: "#f1f5ee",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  message: {
    color: "#b7c1ba",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#c9f36a",
    borderRadius: 6,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#101512",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#67726b",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#f1f5ee",
    fontSize: 16,
    fontWeight: "600",
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  modeLabel: {
    color: "#f1f5ee",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  bottomBar: {
    alignItems: "center",
    gap: 12,
    paddingBottom: 20,
  },
  captureButton: {
    alignItems: "center",
    aspectRatio: 1,
    borderColor: "#ffffff",
    borderRadius: 36,
    borderWidth: 3,
    height: 72,
    justifyContent: "center",
  },
  captureButtonDisabled: {
    opacity: 0.45,
  },
  captureButtonInner: {
    aspectRatio: 1,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    height: 48,
  },
  errorMessage: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  caption: {
    color: "#f1f5ee",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  screen: {
    flex: 1,
    backgroundColor: "#101512",
    paddingHorizontal: 28,
    paddingVertical: 24,
    justifyContent: "space-between",
  },
  copy: {
    gap: 12,
    paddingTop: 24,
  },
  actions: {
    gap: 12,
    paddingBottom: 16,
  },
  title: {
    color: "#f1f5ee",
    fontSize: 30,
    fontWeight: "700",
  },
});
