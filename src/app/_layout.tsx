import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { colors } from "../ui/tokens";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}
