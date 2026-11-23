import type { SFSymbol } from "expo-symbols";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { selectFeedback } from "../platform/haptics";
import { Button } from "./kit/Button";
import { Icon } from "./kit/Icon";
import { PrivacyNotice } from "./PrivacyNotice";
import { colors, radius, space, type } from "./tokens";
import { ALL_ORIENTATIONS, CONTENT_MAX_WIDTH } from "./useLayout";

type Page = { icons: SFSymbol[]; title: string; body: string };

// lo que hay en la app hoy, en el orden en que se usa
const PAGES: Page[] = [
  {
    icons: ["photo.on.rectangle", "camera.aperture", "square.grid.3x3"],
    title: "Empieza",
    body: "Importa una foto o un clip, usa la cámara (toca para foto, mantén para clip) o crea sin imagen con un generador: Noise, Barras, Voronoi, Grilla, Tablero o Anillos.",
  },
  {
    icons: ["paintbrush.pointed"],
    title: "Pinta",
    body: "Pinta con sellos de glitch: Chroma, Mosh, Pixel y Smear. Lo que pintas es la capa PINTURA: la puedes mover, ocultar o borrar en Capas.",
  },
  {
    icons: ["wand.and.stars", "square.3.layers.3d"],
    title: "Apila efectos",
    body: "Añade efectos y generadores y ordénalos en Capas. Arrastra sobre la imagen para ajustar el efecto elegido; si te equivocas, el bote lo quita y ↶ lo deshace.",
  },
  {
    icons: ["waveform.path", "hand.draw"],
    title: "Dale movimiento",
    body: "En Modulación, una onda, el azar, unos pasos, el ritmo, tu toque o el sonido mueven los efectos; la bolita de la gráfica te muestra cómo. En Gesto grabas un movimiento con el dedo y se repite en bucle.",
  },
  {
    icons: ["square.stack.3d.up", "square.and.arrow.up"],
    title: "Presenta y exporta",
    body: "Guarda escenas y cambia entre ellas al ritmo, o presenta en modo escenario. Exporta en JPG o GIF, o comparte la receta .synthfx.",
  },
  {
    icons: ["lock.shield"],
    title: "Tu privacidad",
    body: "Todo se queda en tu teléfono: sin cuentas ni servidores. La cámara, Fotos y el micrófono se usan solo cuando tú lo pides, y lo que creas es tuyo.",
  },
];
const LAST = PAGES.length - 1;

type Props = {
  onDone: () => void;
  // quien ya vio la introducción antes del aviso de privacidad solo ve la última página
  privacyOnly?: boolean;
};

// introducción del primer arranque: seis páginas con ilustraciones que flotan y se desplazan con el
// deslizamiento (parallax). La última es la de privacidad, que no se puede omitir: OMITIR lleva a
// ella y «Aceptar y empezar» cierra. Se puede reabrir desde el menú ⋯ del editor. Con «Reducir
// movimiento» solo hay fundidos
export function Onboarding({ onDone, privacyOnly = false }: Props) {
  const { width } = useWindowDimensions();
  const pages = privacyOnly ? PAGES.slice(LAST) : PAGES;
  const [page, setPage] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const reduced = useReducedMotion();
  // vaivén suave de las ilustraciones (0 → 1 → 0)
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    float.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduced, float]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });
  const last = page === pages.length - 1;
  const goTo = (i: number) => scroller.current?.scrollTo({ x: i * width, animated: !reduced });
  const next = () => {
    selectFeedback();
    if (last) return onDone();
    goTo(page + 1);
  };

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => goTo(pages.length - 1)} supportedOrientations={[...ALL_ORIENTATIONS]}>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          {!last && (
            <Pressable accessibilityRole="button" accessibilityLabel="Omitir la introducción" onPress={() => goTo(pages.length - 1)} hitSlop={12}>
              <Text style={styles.skip}>OMITIR</Text>
            </Pressable>
          )}
        </View>

        <Animated.ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={styles.pages}
        >
          {pages.map((p, i) => (
            <PageView key={p.title} page={p} index={i} count={pages.length} width={width} scrollX={scrollX} float={float} reduced={reduced} />
          ))}
        </Animated.ScrollView>

        <View style={styles.bottom}>
          {pages.length > 1 && (
            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {pages.map((p, i) => (
                <Dot key={p.title} index={i} width={width} scrollX={scrollX} />
              ))}
            </View>
          )}
          {last && (
            <Button
              label="Leer el aviso completo"
              icon="doc.text"
              variant="secondary"
              onPress={() => {
                selectFeedback();
                setPrivacyOpen(true);
              }}
            />
          )}
          <Button label={last ? "Aceptar y empezar" : "Siguiente"} icon={last ? "checkmark" : "arrow.right"} onPress={next} />
        </View>
      </SafeAreaView>
      {privacyOpen && <PrivacyNotice onClose={() => setPrivacyOpen(false)} />}
    </Modal>
  );
}

// una página: la ilustración se desplaza más lento que el texto (parallax), crece al centrarse y
// flota; título y texto se desvanecen al salir
function PageView({
  page,
  index,
  count,
  width,
  scrollX,
  float,
  reduced,
}: {
  page: Page;
  index: number;
  count: number;
  width: number;
  scrollX: SharedValue<number>;
  float: SharedValue<number>;
  reduced: boolean;
}) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];
  const art = useAnimatedStyle(() => {
    const x = scrollX.get();
    return {
      opacity: interpolate(x, range, [0, 1, 0], "clamp"),
      transform: reduced
        ? []
        : [{ translateX: interpolate(x, range, [width * 0.45, 0, -width * 0.45], "clamp") }, { scale: interpolate(x, range, [0.7, 1, 0.7], "clamp") }],
    };
  });
  const text = useAnimatedStyle(() => {
    const x = scrollX.get();
    return {
      opacity: interpolate(x, range, [0, 1, 0], "clamp"),
      transform: reduced ? [] : [{ translateY: interpolate(x, range, [24, 0, 24], "clamp") }],
    };
  });
  return (
    <View style={[styles.page, { width }]} accessible accessibilityLabel={`Paso ${index + 1} de ${count}. ${page.title}. ${page.body}`}>
      <Animated.View style={[styles.art, art]}>
        {page.icons.map((icon, i) => (
          <Badge key={icon} icon={icon} order={i} float={float} reduced={reduced} big={page.icons.length === 1} />
        ))}
      </Animated.View>
      <Animated.View style={[styles.textWrap, text]}>
        {count > 1 && (
          <Text style={styles.step}>
            {index + 1} / {count}
          </Text>
        )}
        <Text style={styles.title}>{page.title}</Text>
        <Text style={styles.body}>{page.body}</Text>
      </Animated.View>
    </View>
  );
}

// ilustración de una página: cada icono flota a contratiempo del anterior
function Badge({ icon, order, float, reduced, big }: { icon: SFSymbol; order: number; float: SharedValue<number>; reduced: boolean; big: boolean }) {
  const style = useAnimatedStyle(() => {
    if (reduced) return {};
    const f = order % 2 === 0 ? float.get() : 1 - float.get();
    return { transform: [{ translateY: (f - 0.5) * 10 }, { rotate: `${(f - 0.5) * 4}deg` }] };
  });
  const size = big ? 128 : 96;
  return (
    <Animated.View style={[styles.badge, { width: size, height: size }, style]}>
      <Icon name={icon} size={big ? 56 : 40} />
    </Animated.View>
  );
}

// punto del indicador: se alarga en la página actual siguiendo el dedo
function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    const x = scrollX.get();
    return { width: interpolate(x, range, [6, 18, 6], "clamp"), opacity: interpolate(x, range, [0.4, 1, 0.4], "clamp") };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  top: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space.xl, paddingTop: space.md, minHeight: 44 },
  skip: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2, padding: space.sm },
  pages: { flex: 1 },
  page: { alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  art: { flexDirection: "row", gap: space.md, marginBottom: space.xl },
  badge: { borderRadius: radius.lg, backgroundColor: colors.inkRaised, alignItems: "center", justifyContent: "center" },
  textWrap: { alignItems: "center" },
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
  bottom: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.md },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: space.sm },
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.inkText },
});
