import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ProjectSummary } from "../../project/storage";
import { sceneStore, useScene } from "../../state/activeScene";
import { confirmLeave } from "../../actions/leaveGuard";
import {
  deleteProjectById,
  duplicateProjectById,
  listAllProjects,
  openProjectById,
  renameProjectById,
} from "../../actions/projectActions";
import { reportError } from "../../ui/errors";
import { PrivacyButton } from "../../ui/PrivacyButton";
import { ProjectActionsSheet } from "../../ui/gallery/ProjectActionsSheet";
import { ProjectCard } from "../../ui/gallery/ProjectCard";
import { colors, type } from "../../ui/tokens";
import { useLayout } from "../../ui/useLayout";

const GAP = 12;

// lee los proyectos; si falla, la hoja de error ofrece reintentar la misma lectura
function loadGallery(set: (projects: ProjectSummary[]) => void) {
  try {
    set(listAllProjects());
  } catch (error) {
    void reportError({ title: "No se pudo leer la Galería", error, retry: () => loadGallery(set) });
  }
}

export default function GalleryScreen() {
  const { width } = useWindowDimensions();
  const { regular, landscape, margin } = useLayout();
  // iPad horizontal: más columnas para llenar el ancho
  const columns = landscape ? 6 : regular ? 4 : 2;
  const cardWidth = Math.floor((width - margin * 2 - GAP * (columns - 1)) / columns);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selected, setSelected] = useState<ProjectSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const activeId = useScene((s) => s.project?.id ?? null);

  const refresh = useCallback(() => loadGallery(setProjects), []);

  useFocusEffect(refresh);

  const open = async (project: ProjectSummary) => {
    if (project.error) {
      setMessage(project.error);
      return;
    }
    if (project.id === sceneStore.getState().project?.id) {
      router.push("/project");
      return;
    }
    if (!(await confirmLeave())) return;
    const result = openProjectById(project.id);
    if (result.ok) {
      setMessage(null);
      router.push("/project");
    } else {
      void reportError({ title: "No se pudo abrir el proyecto", error: result.error, retry: () => open(project) });
    }
  };

  const afterAction = <T,>(result: T): T => {
    refresh();
    return result;
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={[styles.header, { paddingHorizontal: margin }]}>
        <Text style={styles.bigTitle}>Galería</Text>
        <View style={styles.headerRight}>
          <Text style={styles.count}>{projects.length} PROYECTOS</Text>
          <PrivacyButton />
        </View>
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
        onRename={(id, name) => afterAction(renameProjectById(id, name))}
        onDuplicate={(id) => afterAction(duplicateProjectById(id))}
        onDelete={(id) => afterAction(deleteProjectById(id))}
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "center" },
  bigTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.largeTitle, fontWeight: "700" },
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
