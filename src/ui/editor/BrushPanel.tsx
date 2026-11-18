import { StyleSheet, Text, View } from "react-native";

import type { BrushTool } from "../../paint/strokeInterpolate";
import { IconTiles, type IconTile } from "../kit/IconTiles";
import { Slider } from "../Slider";
import { colors, space, type } from "../tokens";

export type { BrushTool };

const TOOLS: readonly IconTile<BrushTool>[] = [
  { id: "chromatic", label: "CHROMA", icon: "circle.lefthalf.filled", hint: "Separa los canales de color" },
  { id: "datamosh", label: "MOSH", icon: "square.stack.3d.down.right", hint: "Arrastra bloques de la imagen" },
  { id: "pixel", label: "PIXEL", icon: "square.grid.3x3", hint: "Pixela la zona pintada" },
  { id: "smear", label: "SMEAR", icon: "scribble.variable", hint: "Corre la imagen en la dirección del trazo" },
  { id: "erase", label: "BORRAR", icon: "eraser", hint: "Quita la pintura" },
];

type Props = {
  tool: BrushTool;
  // 0-1 de cada deslizador
  size: number;
  spacing: number;
  strokes: number;
  maxStrokes: number;
  onTool: (tool: BrushTool) => void;
  onSize: (v: number) => void;
  onSpacing: (v: number) => void;
  // mientras se ajusta un deslizador se muestra el cuadrado de vista previa
  onPreview: (visible: boolean) => void;
};

// panel Pincel: la herramienta como fichas con icono (igual que las fuentes de modulación),
// tamaño y distancia entre sellos, y el conteo de trazos
export function BrushPanel(props: Props) {
  const { tool, size, spacing, strokes, maxStrokes, onTool, onSize, onSpacing, onPreview } = props;
  return (
    <View style={styles.root}>
      <IconTiles tiles={TOOLS} value={tool} onChange={onTool} />
      <View style={styles.sliders}>
        <Slider label="Tamaño" value={size} onChange={onSize} onSlidingStart={() => onPreview(true)} onSlidingEnd={() => onPreview(false)} />
        <Slider label="Distancia" value={spacing} onChange={onSpacing} onSlidingStart={() => onPreview(true)} onSlidingEnd={() => onPreview(false)} />
      </View>
      <Text style={styles.count}>
        {strokes} / {maxStrokes} TRAZOS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  sliders: { flexDirection: "row", gap: space.xl },
  count: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1, fontVariant: ["tabular-nums"] },
});
