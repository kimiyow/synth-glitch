import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ProjectSummary } from "../../project/storage";
import { MEDIA_KIND_LABEL, shortDate } from "../format";
import { colors, radius, type } from "../tokens";

type Props = {
  project: ProjectSummary;
  width: number;
  active: boolean;
  onOpen: () => void;
  onMore: () => void;
};

// ficha de la Galería: tocar abre; mantener pulsado abre las acciones
export function ProjectCard({ project, width, active, onOpen, onMore }: Props) {
  const meta = [project.mediaKind ? MEDIA_KIND_LABEL[project.mediaKind] : null, shortDate(project.updatedAt)]
    .filter(Boolean)
    .join(" · ");
  const badge = project.error ? "DAÑADO" : project.readOnly ? "SOLO LECTURA" : active ? "ABIERTO" : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${project.name}. Mantén pulsado para más opciones`}
      onPress={onOpen}
      onLongPress={onMore}
      delayLongPress={350}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <View style={[styles.thumb, { width, height: Math.round((width * 4) / 3) }]}>
        {project.thumbUri ? (
          // thumb.jpg se reescribe en el mismo archivo al guardar: la clave con la fecha del guardado
          // obliga a leer la versión nueva en lugar de reutilizar la anterior
          <Image
            source={{ uri: project.thumbUri, cacheKey: `${project.id}-${project.updatedAt}` }}
            recyclingKey={`${project.id}-${project.updatedAt}`}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory"
          />
        ) : (
          <Text style={styles.noThumb}>SIN MINIATURA</Text>
        )}
        {badge && <Text style={styles.badge}>{badge}</Text>}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {project.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {meta}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  thumb: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inkRaised,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  noThumb: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1.2 },
  badge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.paper,
    color: colors.paperText,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.2,
  },
  name: { color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600", marginTop: 8 },
  meta: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2, marginTop: 2 },
});
