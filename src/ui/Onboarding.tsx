import type { SFSymbol } from "expo-symbols";
import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { selectFeedback } from "../platform/haptics";
import { Button } from "./kit/Button";
import { Icon } from "./kit/Icon";
import { colors, radius, space, type } from "./tokens";
import { CONTENT_MAX_WIDTH } from "./useLayout";

type Page = { icons: SFSymbol[]; title: string; body: string };

const PAGES: Page[] = [
  {
    icons: ["camera.aperture"],
    title: "Captura",
    body: "Toca el obturador para una foto o mantenlo para grabar un clip de hasta 5 s. También puedes importar de Fotos o crear sin imagen.",
  },
  {
    icons: ["paintbrush.pointed", "wand.and.stars"],
    title: "Pinta y aplica efectos",
    body: "Pinta con sellos de glitch y apila efectos y generadores. Arrastra sobre la imagen para ajustar el efecto seleccionado.",
  },
  {
    icons: ["waveform.path", "play.rectangle"],
    title: "Modula y presenta",
    body: "Mueve los efectos con LFO, secuenciador o el micrófono. Exporta JPG o GIF, o entra al modo escenario desde el menú ⋯.",
  },
];

/**
 * Onboarding (UI-02): tres pantallas en el primer arranque, omisible y reabrible desde
 * el menú ⋯ del editor. Ilustraciones en blanco y negro con SF Symbols (4.4).
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);
  const last = page === PAGES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };
  const next = () => {
    selectFeedback();
    if (last) return onDone();
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onDone}>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Omitir la introducción" onPress={onDone} hitSlop={12}>
            <Text style={styles.skip}>OMITIR</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={styles.pages}
        >
          {PAGES.map((p, i) => (
            <View
              key={p.title}
              style={[styles.page, { width }]}
              accessible
              accessibilityLabel={`Paso ${i + 1} de ${PAGES.length}. ${p.title}. ${p.body}`}
            >
              <View style={styles.art}>
                {p.icons.map((icon) => (
                  <View key={icon} style={styles.badge}>
                    <Icon name={icon} size={44} />
                  </View>
                ))}
              </View>
              <Text style={styles.step}>
                {i + 1} / {PAGES.length}
              </Text>
              <Text style={styles.title}>{p.title}</Text>
              <Text style={styles.body}>{p.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.bottom}>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {PAGES.map((p, i) => (
              <View key={p.title} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
          <Button label={last ? "Empezar" : "Siguiente"} icon={last ? "checkmark" : "arrow.right"} onPress={next} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  top: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space.xl, paddingTop: space.md },
  skip: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2, padding: space.sm },
  pages: { flex: 1 },
  page: { alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  art: { flexDirection: "row", gap: space.md, marginBottom: space.xl },
  badge: {
    width: 104,
    height: 104,
    borderRadius: radius.lg,
    backgroundColor: colors.inkRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  step: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2, marginBottom: space.sm },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.display - 6, fontWeight: "600", textAlign: "center" },
  body: {
    maxWidth: CONTENT_MAX_WIDTH,
    marginTop: space.md,
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.body,
    lineHeight: 22,
    textAlign: "center",
  },
  bottom: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.lg },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.inkLineStrong },
  dotOn: { width: 18, backgroundColor: colors.inkText },
});
