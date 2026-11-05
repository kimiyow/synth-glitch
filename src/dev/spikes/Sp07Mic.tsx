import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { DEFAULT_SOURCES } from "../../modulation/sources";
import { MIC_POLL_MS, useMicMeter } from "../../platform/useMicMeter";
import { colors, geometry } from "../../ui/tokens";
import { labStyles } from "../lab/labUi";

/**
 * SP-07: frecuencia real de lectura de `expo-audio` con medición y latencia percibida.
 * Aplaude: el cuadro destella en cada golpe; si el destello llega tarde se nota a simple vista.
 */
export function Sp07Mic() {
  const mic = useMicMeter(true, DEFAULT_SOURCES.mic);
  const flash = useSharedValue(0);

  // El contador de golpes lo escribe JS; aquí se lee desde JS para el destello (solo laboratorio).
  useEffect(() => {
    let seen = mic.hits.get();
    const id = setInterval(() => {
      const h = mic.hits.get();
      if (h !== seen) {
        seen = h;
        flash.set(1);
        flash.set(withTiming(0, { duration: 250 }));
      }
    }, 16);
    return () => clearInterval(id);
  }, [mic.hits, flash]);

  const bar = useAnimatedStyle(() => ({ width: `${Math.round(mic.level.get() * 100)}%` }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  return (
    <View style={styles.root}>
      <Text style={labStyles.data}>ESTADO {mic.state.toUpperCase()}</Text>
      <Text style={labStyles.data}>
        LECTURA CADA {mic.pollMs === null ? "—" : mic.pollMs.toFixed(0)} MS (META {MIC_POLL_MS}) · {mic.db === null ? "—" : mic.db.toFixed(1)} DB
      </Text>
      <View style={styles.meter}>
        <Animated.View style={[styles.fill, bar]} />
      </View>
      <View style={styles.box}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
        <Text style={labStyles.label}>APLAUDE: ESTE CUADRO DESTELLA EN CADA GOLPE</Text>
      </View>
      <Text style={labStyles.label}>
        Piso -50 dB, techo -10 dB, umbral 0.70 (valores por defecto). Si los dB no se mueven al hablar, la medición no
        llega en dB y hay que ajustar la escala.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: geometry.compactMargin, gap: 12 },
  meter: { height: 12, backgroundColor: colors.inkRaised, overflow: "hidden" },
  fill: { height: 12, backgroundColor: colors.inkText },
  box: { height: 180, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.inkLineStrong },
  flash: { backgroundColor: colors.paper },
});
