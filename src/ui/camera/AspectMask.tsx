import { StyleSheet, View } from "react-native";

import { cropRectFor } from "../../engine/crop";
import type { CameraAspect } from "../../state/settings";
import { CornerMarks } from "../CornerMarks";
import { colors } from "../tokens";

// máscara sobre el visor 3:4 (el sensor entrega 4:3): oscurece lo que queda fuera del recorte
// elegido y marca sus esquinas. Usa el mismo cálculo que el proyecto
export function AspectMask({ width, height, aspect }: { width: number; height: number; aspect: CameraAspect }) {
  const [x, y, w, h] = cropRectFor(width, height, aspect);
  const box = { left: x * width, top: y * height, width: w * width, height: h * height };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.shade, { left: 0, top: 0, right: 0, height: box.top }]} />
      <View style={[styles.shade, { left: 0, bottom: 0, right: 0, height: height - box.top - box.height }]} />
      <View style={[styles.shade, { left: 0, top: box.top, width: box.left, height: box.height }]} />
      <View
        style={[styles.shade, { right: 0, top: box.top, width: width - box.left - box.width, height: box.height }]}
      />
      <View style={[styles.box, box]}>
        {/* cuadrícula de tercios, muy tenue */}
        <View style={[styles.lineV, { left: "33.333%" }]} />
        <View style={[styles.lineV, { left: "66.666%" }]} />
        <View style={[styles.lineH, { top: "33.333%" }]} />
        <View style={[styles.lineH, { top: "66.666%" }]} />
        <CornerMarks size={22} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { position: "absolute", backgroundColor: colors.scrim },
  box: { position: "absolute" },
  lineV: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: colors.inkLineStrong },
  lineH: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.inkLineStrong },
});
