import { Canvas, Fill } from "@shopify/react-native-skia";
import { useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { useEffect } from "react";
import {
    Linking,
    Pressable,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function HomeScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [photosPermission, requestPhotosPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
  });

  useEffect(() => {
    if (cameraPermission?.status === "undetermined") {
      void requestCameraPermission();
      return;
    }

    if (photosPermission?.status === "undetermined") {
      void requestPhotosPermission();
    }
  }, [
    cameraPermission?.status,
    photosPermission?.status,
    requestCameraPermission,
    requestPhotosPermission,
  ]);

  if (!cameraPermission || !photosPermission) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.message}>Solicitando permisos...</Text>
      </SafeAreaView>
    );
  }

  const missingPermissions = [
    cameraPermission.granted ? null : "la cámara",
    photosPermission.granted ? null : "guardar imágenes en Fotos",
  ].filter((permission): permission is string => permission !== null);

  if (missingPermissions.length > 0) {
    const canAskAgain =
      (!cameraPermission.granted && cameraPermission.canAskAgain) ||
      (!photosPermission.granted && photosPermission.canAskAgain);

    const retryPermissions = async () => {
      if (!cameraPermission.granted && cameraPermission.canAskAgain) {
        await requestCameraPermission();
      }
      if (!photosPermission.granted && photosPermission.canAskAgain) {
        await requestPhotosPermission();
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

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>SYNTHVJ / FASE 00</Text>
        <Text style={styles.title}>Permisos concedidos</Text>
      </View>
      <View accessible accessibilityLabel="Lienzo de prueba de Skia" style={styles.canvasFrame}>
        <Canvas style={styles.canvas}>
          <Fill color="#c9f36a" />
        </Canvas>
      </View>
      <Text style={styles.caption}>Skia Canvas activo</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  eyebrow: {
    color: "#c9f36a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: {
    color: "#f1f5ee",
    fontSize: 30,
    fontWeight: "700",
  },
  message: {
    color: "#b7c1ba",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  actions: {
    gap: 12,
    paddingBottom: 16,
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
  canvasFrame: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#1b251f",
    borderColor: "#354138",
    borderWidth: 1,
    justifyContent: "center",
    padding: 16,
  },
  canvas: {
    height: 220,
    width: 220,
  },
  caption: {
    color: "#b7c1ba",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
