import { Stack } from "expo-router";
import { DeviceType, deviceType } from "expo-device";
import { lockAsync, OrientationLock } from "expo-screen-orientation";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DEV_TOOLS_ENABLED } from "../dev/devTools";
import { PerfHud } from "../dev/PerfHud";
import { settingsStore, useSettings } from "../state/appSettings";
import { IntroOverlay } from "../ui/IntroOverlay";
import { Onboarding } from "../ui/Onboarding";
import { colors } from "../ui/tokens";

export default function RootLayout() {
  const [intro, setIntro] = useState(true);
  const onboardingSeen = useSettings((s) => s.onboardingSeen);
  // UI-03 / 4.4: el iPad admite todas las orientaciones; el iPhone se queda en vertical.
  useEffect(() => {
    if (deviceType !== DeviceType.TABLET) void lockAsync(OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="test-lab" />
      </Stack>
      {DEV_TOOLS_ENABLED && <PerfHud />}
      {intro && <IntroOverlay onDone={() => setIntro(false)} />}
      {!intro && !onboardingSeen && <Onboarding onDone={() => settingsStore.getState().update({ onboardingSeen: true })} />}
    </GestureHandlerRootView>
  );
}
