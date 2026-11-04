import { Tabs } from "expo-router";
import { Text } from "react-native";

import { useScene } from "../../state/activeScene";
import { colors, type } from "../../ui/tokens";

const TAB_BAR_STYLE = { backgroundColor: colors.ink, borderTopColor: colors.inkLine };

export default function TabsLayout() {
  // Figma: con un proyecto abierto, la barra de herramientas del Editor ocupa el lugar de las pestañas.
  const projectOpen = useScene((s) => s.project !== null);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.inkText,
        tabBarInactiveTintColor: colors.inkMute,
        tabBarStyle: TAB_BAR_STYLE,
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
      <Tabs.Screen
        name="editor"
        options={{ title: "EDITOR", tabBarStyle: projectOpen ? { display: "none" } : TAB_BAR_STYLE }}
      />
      <Tabs.Screen name="gallery" options={{ title: "GALERÍA" }} />
    </Tabs>
  );
}
