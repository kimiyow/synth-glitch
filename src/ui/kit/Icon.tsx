import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { Platform, Text, type ColorValue } from "react-native";
import { colors } from "../tokens";

// equivalente en Material Symbols de cada SF Symbol que usa la app: en Android, expo-symbols no
// entiende los nombres de SF y mostraría el respaldo («•»). Los nombres se validaron contra
// expo-symbols/build/android/symbols.json. Un icono nuevo necesita su línea aquí
const MATERIAL: Partial<Record<string, AndroidSymbol>> = {
  "arrow.clockwise": "refresh",
  "arrow.counterclockwise": "restart_alt",
  "arrow.down": "arrow_downward",
  "arrow.down.to.line": "download",
  "arrow.left.and.right": "swap_horiz",
  "arrow.left.arrow.right": "swap_horiz",
  "arrow.right": "arrow_forward",
  "arrow.triangle.2.circlepath": "autorenew",
  "arrow.up.and.down": "swap_vert",
  "arrow.uturn.backward": "undo",
  "arrow.uturn.forward": "redo",
  "bolt": "bolt",
  "bolt.slash": "flash_off",
  "camera": "photo_camera",
  "camera.aperture": "camera",
  "camera.rotate": "cameraswitch",
  "chart.bar.fill": "bar_chart",
  "chart.line.uptrend.xyaxis": "show_chart",
  "checkmark": "check",
  "chevron.down": "expand_more",
  "chevron.left": "chevron_left",
  "chevron.right": "chevron_right",
  "chevron.up": "expand_less",
  "circle": "circle",
  "circle.lefthalf.filled": "contrast",
  "dice": "casino",
  "doc.text": "description",
  "ellipsis": "more_horiz",
  "eraser": "ink_eraser",
  "exclamationmark.triangle": "warning",
  "eye": "visibility",
  "eye.slash": "visibility_off",
  "folder": "folder",
  "gauge.with.dots.needle.67percent": "speed",
  "gearshape": "settings",
  "gyroscope": "screen_rotation",
  "hand.draw": "gesture",
  "hand.point.up.left": "touch_app",
  "hand.tap": "touch_app",
  "iphone": "smartphone",
  "line.3.horizontal": "drag_handle",
  "lock": "lock",
  "lock.fill": "lock",
  "lock.shield": "shield_lock",
  "metronome": "timer",
  "mic": "mic",
  "paintbrush.pointed": "brush",
  "pencil": "edit",
  "photo": "image",
  "photo.on.rectangle": "photo_library",
  "play.fill": "play_arrow",
  "play.rectangle": "slideshow",
  "plus": "add",
  "plus.square.on.square": "library_add",
  "questionmark.circle": "help",
  "repeat": "repeat",
  "scribble.variable": "draw",
  "slider.horizontal.3": "tune",
  "sparkles": "auto_awesome",
  "sparkles.rectangle.stack": "gif_box",
  "square.3.layers.3d": "layers",
  "square.and.arrow.down": "download",
  "square.and.arrow.up": "ios_share",
  "square.grid.2x2": "grid_view",
  "square.grid.3x3": "grid_on",
  "square.grid.3x3.fill": "grid_on",
  "square.stack.3d.down.right": "stacks",
  "square.stack.3d.up": "stacks",
  "trash": "delete",
  "tray.and.arrow.down": "move_to_inbox",
  "wand.and.rays": "auto_fix_high",
  "wand.and.stars": "auto_fix_high",
  "waveform": "graphic_eq",
  "waveform.path": "airwave",
  "xmark": "close",
};

// icono SF Symbols (iOS) o su equivalente Material (Android). Si no existe, muestra el texto de
// respaldo
export function Icon({
  name,
  size = 22,
  color = colors.inkText,
  fallback = "•",
}: {
  name: SFSymbol;
  size?: number;
  color?: ColorValue;
  fallback?: string;
}) {
  return (
    <SymbolView
      name={{ ios: name, android: MATERIAL[name] }}
      size={size}
      tintColor={color}
      // el peso con nombre es de iOS; en Android se usa el de la fuente
      weight={Platform.OS === "ios" ? "regular" : undefined}
      fallback={<Text style={{ color, fontSize: size * 0.8 }}>{fallback}</Text>}
    />
  );
}
