import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ProjectSummary } from "../../project/storage";
import { useScene } from "../../state/activeScene";
import {
  deleteProjectById,
  duplicateProjectById,
  listAllProjects,
  openProjectById,
  renameProjectById,
} from "../../state/projectActions";
import { ProjectActionsSheet } from "../../ui/gallery/ProjectActionsSheet";
import { ProjectCard } from "../../ui/gallery/ProjectCard";
import { colors, type } from "../../ui/tokens";
import { useLayout } from "../../ui/useLayout";

const GAP = 12;

export default function GalleryScreen() {
  const { width } = useWindowDimensions();
  const { regular, margin } = useLayout();
  const columns = regular ? 4 : 2;
  const cardWidth = Math.floor((width - margin * 2 - GAP * (columns - 1)) / columns);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selected, setSelected] = useState<ProjectSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const activeId = useScene((s) => s.project?.id ?? null);

  const refresh = useCallback(() => {
    try {
      setProjects(listAllProjects());
    } catch (error) {
      setMessage(`NO SE PUDO LEER LA GALERÍA · ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  useFocusEffect(refresh);

  const open = (project: ProjectSummary) => {
    if (project.error) {
      setMessage(project.error);
      return;
    }
    const result = openProjectById(project.id);
    if (result.ok) {
      setMessage(null);
      router.navigate("/editor");
    } else {
      setMessage(result.error);
    }
  };

  const afterAction = <T,>(result: T): T => {
    refresh();
    return result;
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={[styles.header, { paddingHorizontal: margin }]}>
        <Text style={styles.title}>GALERÍA</Text>
        <Text style={styles.count}>{projects.length} PROYECTOS</Text>
      </View>
      {message && (
        <Text style={[styles.message, { marginHorizontal: margin }]} onPress={() => setMessage(null)}>
          {message}
        </Text>
      )}

      <FlatList
        key={columns}
        data={projects}
        keyExtractor={(p) => p.id}
        numColumns={columns}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={[styles.list, { paddingHorizontal: margin }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.title}>SIN PROYECTOS</Text>
            <Text style={styles.count}>CAPTURA O IMPORTA UNA IMAGEN DESDE CÁMARA</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            width={cardWidth}
            active={item.id === activeId}
            onOpen={() => open(item)}
            onMore={() => setSelected(item)}
          />
        )}
      />

      <ProjectActionsSheet
        project={selected}
        onClose={() => setSelected(null)}
        onRename={(name) => afterAction(renameProjectById(selected!.id, name))}
        onDuplicate={() => afterAction(duplicateProjectById(selected!.id))}
        onDelete={() => afterAction(deleteProjectById(selected!.id))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.title, letterSpacing: 1.2 },
  count: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  message: {
    color: colors.paperText,
    backgroundColor: colors.paper,
    fontFamily: type.family,
    fontSize: type.label,
    padding: 8,
    marginBottom: 8,
  },
  list: { gap: GAP, paddingBottom: 32 },
  empty: { alignItems: "center", gap: 8, paddingTop: 120 },
});
