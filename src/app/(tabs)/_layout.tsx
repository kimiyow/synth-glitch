import { Tabs } from "expo-router";
import { Icon } from "../../ui/kit/Icon";

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
          letterSpacing: 0.6,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "CÁMARA", tabBarIcon: ({ color }) => <Icon name="camera" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="editor"
        options={{
          title: "EDITOR",
          tabBarIcon: ({ color }) => <Icon name="slider.horizontal.3" size={22} color={color} />,
          tabBarStyle: projectOpen ? { display: "none" } : TAB_BAR_STYLE,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{ title: "GALERÍA", tabBarIcon: ({ color }) => <Icon name="square.grid.2x2" size={22} color={color} /> }}
      />
    </Tabs>
  );
}
