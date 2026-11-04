import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, geometry, type } from "../ui/tokens";
import { LAB_TESTS } from "./labTests";

/** Pantalla de pruebas en el dispositivo (solo desarrollo). */
export function TestLab() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = LAB_TESTS.find((t) => t.id === activeId) ?? null;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => (active ? setActiveId(null) : router.back())}
          style={styles.headerButton}
        >
          <Text style={styles.headerText}>← {active ? "LAB" : "SALIR"}</Text>
        </Pressable>
        <Text style={styles.headerText}>{active ? active.title : "TEST LAB"}</Text>
      </View>

      {active ? (
        <View style={styles.body}>
          <active.Component />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {LAB_TESTS.length === 0 && <Text style={styles.mute}>SIN PRUEBAS</Text>}
          {LAB_TESTS.map((test) => (
            <Pressable
              key={test.id}
              accessibilityRole="button"
              onPress={() => setActiveId(test.id)}
              style={styles.item}
            >
              <Text style={styles.itemTitle}>{test.title}</Text>
              <Text style={styles.mute}>{test.description}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: geometry.compactMargin,
    minHeight: geometry.target,
    borderBottomColor: colors.inkLine,
    borderBottomWidth: geometry.hairline,
  },
  headerButton: { minHeight: geometry.target, justifyContent: "center" },
  headerText: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
  },
  body: { flex: 1 },
  list: { padding: geometry.compactMargin, gap: 8 },
  item: {
    padding: 12,
    gap: 4,
    borderColor: colors.inkLine,
    borderWidth: geometry.hairline,
  },
  itemTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.body },
  mute: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label },
});
