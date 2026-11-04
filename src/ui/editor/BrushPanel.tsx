import { StyleSheet, Text, View } from "react-native";

import type { BrushTool } from "../../paint/strokeInterpolate";
import { Pill } from "../kit/Pill";
import { Slider } from "../Slider";
import { colors, type } from "../tokens";

export type { BrushTool };

const CHIPS: { id: BrushTool; label: string }[] = [
  { id: "chromatic", label: "CHROMATIC" },
  { id: "datamosh", label: "DATAMOSH" },
  { id: "pixel", label: "PIXEL" },
  { id: "smear", label: "SMEAR" },
  { id: "erase", label: "BORRAR" },
];

type Props = {
  tool: BrushTool;
  /** 0-1 de cada deslizador. */
  size: number;
  spacing: number;
  strokes: number;
  maxStrokes: number;
  onTool: (tool: BrushTool) => void;
  onSize: (v: number) => void;
  onSpacing: (v: number) => void;
  /** Mientras se ajusta un deslizador se muestra el cuadrado de vista previa (BRU-02). */
  onPreview: (visible: boolean) => void;
};

/** Panel Pincel del Figma: Tamaño Pincel, Distancia mínima y chips de efecto. */
export function BrushPanel(props: Props) {
  const { tool, size, spacing, strokes, maxStrokes, onTool, onSize, onSpacing, onPreview } = props;
  return (
    <View style={styles.root}>
      <View style={styles.sliders}>
        <Slider
          label="Tamaño Pincel"
          value={size}
          onChange={onSize}
          onSlidingStart={() => onPreview(true)}
          onSlidingEnd={() => onPreview(false)}
        />
        <Slider
          label="Distancia mínima"
          value={spacing}
          onChange={onSpacing}
          onSlidingStart={() => onPreview(true)}
          onSlidingEnd={() => onPreview(false)}
        />
      </View>
      <View style={styles.chips}>
        {CHIPS.map((chip) => (
          <Pill key={chip.id} label={chip.label} selected={chip.id === tool} onPress={() => onTool(chip.id)} />
        ))}
      </View>
      <Text style={styles.count}>
        {strokes} / {maxStrokes} TRAZOS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  sliders: { flexDirection: "row", gap: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  count: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro },
});
