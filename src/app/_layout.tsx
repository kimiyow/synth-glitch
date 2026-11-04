import { Stack } from "expo-router";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DEV_TOOLS_ENABLED } from "../dev/devTools";
import { PerfHud } from "../dev/PerfHud";
import { IntroOverlay } from "../ui/IntroOverlay";
import { colors } from "../ui/tokens";

export default function RootLayout() {
  const [intro, setIntro] = useState(true);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="test-lab" />
      </Stack>
      {DEV_TOOLS_ENABLED && <PerfHud />}
      {intro && <IntroOverlay onDone={() => setIntro(false)} />}
    </GestureHandlerRootView>
  );
}
