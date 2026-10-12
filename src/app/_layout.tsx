import { Tabs } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#c9f36a",
          tabBarInactiveTintColor: "#9ba69e",
          tabBarStyle: {
            backgroundColor: "#101512",
            borderTopColor: "#2d3a32",
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Cámara" }} />
        <Tabs.Screen name="editor" options={{ title: "Editor" }} />
      </Tabs>
    </GestureHandlerRootView>
  );
}
