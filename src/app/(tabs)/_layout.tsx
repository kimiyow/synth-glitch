import { Tabs } from "expo-router";
import { Text } from "react-native";

import { colors, type } from "../../ui/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.inkText,
        tabBarInactiveTintColor: colors.inkMute,
        tabBarStyle: {
          backgroundColor: colors.ink,
          borderTopColor: colors.inkLine,
        },
        tabBarLabelStyle: {
          fontFamily: type.family,
          fontSize: type.label,
          fontWeight: "500",
          textTransform: "uppercase",
        },
        // Figma: triángulo ▼ sobre cada etiqueta, blanco en la pestaña activa.
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 12 }}>▼</Text>,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "CÁMARA" }} />
      <Tabs.Screen name="editor" options={{ title: "EDITOR" }} />
      <Tabs.Screen name="gallery" options={{ title: "GALERÍA" }} />
    </Tabs>
  );
}
