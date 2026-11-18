import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { router, useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { cancelAnimation, Easing, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSettings, settingsStore } from "../../state/appSettings";
import { createProjectFromClip, createProjectFromPhoto } from "../../actions/captureActions";
import { confirmLeave } from "../../actions/leaveGuard";
import { AppHeader } from "../../ui/AppHeader";
import { IconButton } from "../../ui/kit/IconButton";
import { AspectMask } from "../../ui/camera/AspectMask";
import { AspectPicker } from "../../ui/camera/AspectPicker";
import { RecBadge } from "../../ui/camera/RecBadge";
import { Shutter } from "../../ui/camera/Shutter";
import { PermissionScreen } from "../../ui/PermissionScreen";
import { colors, radius, space, type } from "../../ui/tokens";

const MAX_CLIP_S = 5;
const VIEWFINDER_MARGIN = 18;
// alto mínimo para el obturador (72 pt), el texto y los márgenes bajo el visor
const CONTROLS_MIN_HEIGHT = 150;
// botón lateral de la fila del obturador (girar cámara) y su hueco simétrico
const SIDE_BUTTON = 48;
const MIN_CLIP_MS = 1000;
const DOUBLE_TAP_MS = 300;
// si la cámara no avisa que está lista tras cambiar a modo video, se graba igual
const MODE_SWITCH_TIMEOUT_MS = 600;

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();

  if (!permission) return <View style={styles.root} />;
  if (!permission.granted) {
    return (
      <PermissionScreen
        title="Cámara"
        reason="SynthVJ usa la cámara para capturar fotos y clips cortos que luego transformas con efectos. Los clips se graban sin audio."
        canAskAgain={permission.canAskAgain}
        onAllow={requestPermission}
      />
    );
  }
  // la cámara se desmonta al salir de la pestaña
  return focused ? <CameraCapture /> : <View style={styles.root} />;
}

function CameraCapture() {
  const { width } = useWindowDimensions();
  // figma: visor con márgenes de 18 pt y esquinas redondeadas; se mantiene 3:4 (sensor). En iPad el
  // ancho daría un visor más alto que la pantalla: se limita por el alto disponible para que el
  // obturador y su texto siempre quepan debajo
  const [areaH, setAreaH] = useState(0);
  const byWidth = width - VIEWFINDER_MARGIN * 2;
  const maxH = areaH > 0 ? areaH - CONTROLS_MIN_HEIGHT : Infinity;
  const viewH = Math.round(Math.min((byWidth * 4) / 3, maxH));
  const viewW = Math.round((viewH * 3) / 4);

  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [mode, setMode] = useState<"picture" | "video">("picture");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const aspect = useSettings((s) => s.cameraAspect);
  const holdHintSeen = useSettings((s) => s.holdHintSeen);

  const progress = useSharedValue(0);
  const lastViewTap = useRef(0);
  const holding = useRef(false);
  // ref además del estado: al soltar justo al empezar, el estado aún no se ha renderizado
  const isRecording = useRef(false);
  const readyWaiter = useRef<(() => void) | null>(null);

  const onCameraReady = () => {
    readyWaiter.current?.();
    readyWaiter.current = null;
  };

  const waitForReady = () =>
    new Promise<void>((resolve) => {
      readyWaiter.current = resolve;
      setTimeout(resolve, MODE_SWITCH_TIMEOUT_MS);
    });

  const finish = (result: { ok: true } | { ok: false; error: string }) => {
    setBusy(false);
    if (result.ok) {
      setMessage(null);
      router.navigate("/editor");
    } else {
      setMessage(`ERROR · ${result.error}`);
    }
  };

  const takePhoto = async () => {
    if (busy || recording) return;
    const camera = cameraRef.current;
    if (!camera) return;
    if (!(await confirmLeave())) return;
    setBusy(true);
    try {
      const photo = await camera.takePictureAsync({ quality: 1 });
      finish(await createProjectFromPhoto(photo.uri, aspect));
    } catch (error) {
      finish({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  const startClip = async () => {
    if (busy || recording) return;
    holding.current = true;
    setMode("video");
    await waitForReady();
    const camera = cameraRef.current;
    if (!holding.current || !camera) {
      setMode("picture");
      return;
    }
    isRecording.current = true;
    setRecording(true);
    progress.set(0);
    progress.set(withTiming(1, { duration: MAX_CLIP_S * 1000, easing: Easing.linear }));
    const startedAt = Date.now();
    let uri: string | undefined;
    try {
      uri = (await camera.recordAsync({ maxDuration: MAX_CLIP_S }))?.uri;
    } catch (error) {
      setMessage(`ERROR · ${error instanceof Error ? error.message : String(error)}`);
    }
    const elapsed = Date.now() - startedAt;
    holding.current = false;
    isRecording.current = false;
    cancelAnimation(progress);
    progress.set(0);
    setRecording(false);
    setMode("picture");
    if (!uri) return;
    if (elapsed < MIN_CLIP_MS) {
      setMessage("CLIP MUY CORTO · MANTÉN AL MENOS 1 S");
      return;
    }
    if (!holdHintSeen) settingsStore.getState().update({ holdHintSeen: true });
    // el clip ya se grabó; si el usuario cancela para no perder su proyecto, se descarta
    if (!(await confirmLeave())) return;
    setBusy(true);
    finish(await createProjectFromClip(uri, aspect));
  };

  const endClip = () => {
    if (!holding.current) return;
    holding.current = false;
    if (isRecording.current) cameraRef.current?.stopRecording();
  };

  const flip = () => setFacing((f) => (f === "back" ? "front" : "back"));

  const onViewfinderPress = () => {
    const now = Date.now();
    if (now - lastViewTap.current < DOUBLE_TAP_MS && !recording) {
      flip();
      lastViewTap.current = 0;
    } else {
      lastViewTap.current = now;
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <AppHeader />

      <View style={styles.area} onLayout={(e) => setAreaH(e.nativeEvent.layout.height)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Visor de la cámara"
          accessibilityHint="Activa para cambiar entre la cámara frontal y la trasera"
          accessibilityActions={[{ name: "activate", label: "Cambiar de cámara" }]}
          onAccessibilityAction={flip}
          onPress={onViewfinderPress}
          style={[styles.viewfinder, { width: viewW, height: viewH }]}
        >
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode={mode}
            mute
            mirror={facing === "front"}
            onCameraReady={onCameraReady}
          />
          <AspectMask width={viewW} height={viewH} aspect={aspect} />
          {recording && (
            <View style={styles.topOverlay} pointerEvents="none">
              <RecBadge maxSeconds={MAX_CLIP_S} />
            </View>
          )}
          <View style={styles.bottomOverlay} pointerEvents="box-none">
            <AspectPicker
              aspect={aspect}
              disabled={busy || recording}
              onSelect={(a) => settingsStore.getState().update({ cameraAspect: a })}
            />
          </View>
        </Pressable>

        <View style={styles.controls}>
          {message && (
            <Text style={styles.message} onPress={() => setMessage(null)}>
              {message}
            </Text>
          )}
          <View style={styles.shutterRow}>
            <View style={styles.sideSlot} />
            <Shutter
              recording={recording}
              disabled={busy}
              progress={progress}
              onTap={takePhoto}
              onHoldStart={startClip}
              onHoldEnd={endClip}
            />
            <View style={styles.sideSlot}>
              <IconButton
                icon="arrow.triangle.2.circlepath"
                label="Cambiar de cámara"
                size={SIDE_BUTTON}
                disabled={busy || recording}
                onPress={flip}
              />
            </View>
          </View>
          <Text style={styles.hint}>
            {busy
              ? "CREANDO PROYECTO…"
              : recording
                ? "GRABANDO · SUELTA PARA TERMINAR"
                : holdHintSeen
                  ? "TOCA PARA CAPTURAR"
                  : "TOCA PARA CAPTURAR · MANTÉN PARA GRABAR"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  viewfinder: {
    alignSelf: "center",
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.inkSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inkLine,
  },
  topOverlay: { position: "absolute", top: space.md, left: 0, right: 0, alignItems: "center" },
  bottomOverlay: { position: "absolute", bottom: space.md, left: 0, right: 0, alignItems: "center" },
  area: { flex: 1 },
  controls: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  shutterRow: { flexDirection: "row", alignItems: "center", gap: 44 },
  sideSlot: { width: SIDE_BUTTON, height: SIDE_BUTTON },
  hint: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  message: {
    color: colors.paperText,
    backgroundColor: colors.paper,
    fontFamily: type.family,
    fontSize: type.label,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
});
