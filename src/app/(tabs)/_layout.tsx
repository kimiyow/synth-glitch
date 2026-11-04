import { Tabs } from "expo-router";

import { colors, type } from "../../ui/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.inkText,
        tabBarInactiveTintColor: colors.inkMute,
        tabBarIconStyle: { display: "none" },
        tabBarStyle: {
          backgroundColor: colors.ink,
          borderTopColor: colors.inkLine,
        },
        tabBarLabelStyle: {
          fontFamily: type.family,
          fontSize: type.label,
          fontWeight: "500",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "CÁMARA" }} />
      <Tabs.Screen name="editor" options={{ title: "EDITOR" }} />
      <Tabs.Screen name="gallery" options={{ title: "GALERÍA" }} />
    </Tabs>
  );
}
