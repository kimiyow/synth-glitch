import { Tabs } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors, type } from "../ui/tokens";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.inkText,
          tabBarInactiveTintColor: colors.inkMute,
          tabBarShowLabel: true,
          tabBarStyle: {
            backgroundColor: colors.ink,
            borderTopColor: colors.inkLine,
            height: 48,
            paddingBottom: 0,
            paddingTop: 0,
          },
          tabBarLabelStyle: {
            fontFamily: type.family,
            fontSize: type.label,
            fontWeight: "500",
            letterSpacing: 1.2,
            marginTop: 0,
            textTransform: "uppercase",
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "CÁMARA" }} />
        <Tabs.Screen name="editor" options={{ title: "EDITOR" }} />
      </Tabs>
    </GestureHandlerRootView>
  );
}
