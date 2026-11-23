import { Stack } from "expo-router";
import { DeviceType, deviceType } from "expo-device";
import { lockAsync, OrientationLock } from "expo-screen-orientation";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DEV_TOOLS_ENABLED } from "../dev/devTools";
import { PerfHud } from "../dev/PerfHud";
import { settingsStore, useSettings } from "../state/appSettings";
import { ConfirmHost } from "../ui/kit/ConfirmHost";
import { IntroOverlay } from "../ui/IntroOverlay";
import { Onboarding } from "../ui/Onboarding";
import { colors } from "../ui/tokens";

export default function RootLayout() {
  const [intro, setIntro] = useState(true);
  const onboardingSeen = useSettings((s) => s.onboardingSeen);
  const privacySeen = useSettings((s) => s.privacySeen);
  // el iPad admite todas las orientaciones; el iPhone se queda en vertical
  useEffect(() => {
    if (deviceType !== DeviceType.TABLET) void lockAsync(OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* sin deslizar desde el borde: salir siempre pasa por la confirmación de cambios */}
        <Stack.Screen name="project" options={{ gestureEnabled: false }} />
        <Stack.Screen name="test-lab" />
      </Stack>
      {DEV_TOOLS_ENABLED && <PerfHud />}
      {intro && <IntroOverlay onDone={() => setIntro(false)} />}
      {/* quien ya había visto la introducción ve solo la página de privacidad, una vez */}
      {!intro && (!onboardingSeen || !privacySeen) && (
        <Onboarding privacyOnly={onboardingSeen} onDone={() => settingsStore.getState().update({ onboardingSeen: true, privacySeen: true })} />
      )}
      <ConfirmHost />
    </GestureHandlerRootView>
  );
}
