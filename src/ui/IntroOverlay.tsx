import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { colors, type } from "./tokens";

const GLITCH_MS = 700;
const TAGLINE_MS = 300;
const HOLD_MS = 550;
const FADE_MS = 350;
const TOTAL_MS = GLITCH_MS + TAGLINE_MS + HOLD_MS + FADE_MS;
const BARS = 4;

/**
 * Animación de entrada (UI-04, S5): un glitch breve en blanco y negro que termina en el
 * wordmark y el lema del Figma. Con Reducir movimiento solo hay un fundido.
 */
export function IntroOverlay({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const glitching = useSharedValue(reduceMotion ? 0 : 1);
  const jitterA = useSharedValue(0);
  const jitterB = useSharedValue(0);
  const skew = useSharedValue(0);
  const bars = useSharedValue<number[]>(Array(BARS * 3).fill(0)); // [y, ancho, opacidad] por barra
  const tagline = useSharedValue(reduceMotion ? 1 : 0);
  const overlay = useSharedValue(1);

  // Solo números en valores compartidos (ver PerfHud).
  useFrameCallback(() => {
    if (glitching.get() === 0) return;
    jitterA.set((Math.random() - 0.5) * 18);
    jitterB.set((Math.random() - 0.5) * 18);
    skew.set((Math.random() - 0.5) * 6);
    const next: number[] = [];
    for (let i = 0; i < BARS; i++) next.push(Math.random(), 0.2 + Math.random() * 0.8, Math.random() < 0.5 ? 0 : 0.9);
    bars.set(next);
  });

  useEffect(() => {
    const settleAt = reduceMotion ? 0 : GLITCH_MS;
    const settle = setTimeout(() => {
      glitching.set(0);
      jitterA.set(0);
      jitterB.set(0);
      skew.set(0);
      bars.set(Array(BARS * 3).fill(0));
      tagline.set(withTiming(1, { duration: TAGLINE_MS }));
    }, settleAt);
    const fadeAt = reduceMotion ? 900 : GLITCH_MS + TAGLINE_MS + HOLD_MS;
    overlay.set(withDelay(fadeAt, withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) })));
    const done = setTimeout(onDone, reduceMotion ? 900 + FADE_MS : TOTAL_MS);
    return () => {
      clearTimeout(settle);
      clearTimeout(done);
    };
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: overlay.get() }));
  const mainStyle = useAnimatedStyle(() => ({ transform: [{ skewX: `${skew.get()}deg` }] }));
  const ghostA = useAnimatedStyle(() => ({ opacity: glitching.get() * 0.55, transform: [{ translateX: jitterA.get() }] }));
  const ghostB = useAnimatedStyle(() => ({ opacity: glitching.get() * 0.35, transform: [{ translateX: jitterB.get() }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.get(), transform: [{ translateY: (1 - tagline.get()) * 8 }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents="none">
      {Array.from({ length: BARS }, (_, i) => (
        <Bar key={i} index={i} bars={bars} />
      ))}
      <View style={styles.center}>
        <Animated.Text style={[styles.wordmark, styles.ghost, ghostB]}>Synth VJ</Animated.Text>
        <Animated.Text style={[styles.wordmark, styles.ghost, styles.ghostDark, ghostA]}>Synth VJ</Animated.Text>
        <Animated.Text style={[styles.wordmark, mainStyle]}>Synth VJ</Animated.Text>
      </View>
      <Animated.Text style={[styles.tagline, taglineStyle]}>create and imagine</Animated.Text>
    </Animated.View>
  );
}

function Bar({ index, bars }: { index: number; bars: { get(): number[] } }) {
  const style = useAnimatedStyle(() => {
    const b = bars.get();
    return {
      top: `${b[index * 3] * 100}%`,
      width: `${b[index * 3 + 1] * 100}%`,
      opacity: b[index * 3 + 2],
    };
  });
  return <Animated.View style={[styles.bar, style]} />;
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.ink, zIndex: 2000 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordmark: { color: colors.inkText, fontFamily: type.family, fontSize: 44, fontWeight: "300", letterSpacing: 1 },
  ghost: { position: "absolute", color: "#BFBFBF" },
  ghostDark: { color: "#5A5A5A" },
  tagline: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: 22,
    fontWeight: "300",
  },
  bar: { position: "absolute", left: 0, height: 3, backgroundColor: colors.inkText },
});
