import type { SFSymbol } from "expo-symbols";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "./kit/Button";
import { Icon } from "./kit/Icon";
import { IconButton } from "./kit/IconButton";
import { colors, radius, space, type } from "./tokens";
import { ALL_ORIENTATIONS, CONTENT_MAX_WIDTH } from "./useLayout";

export const PRIVACY_UPDATED = "22 de noviembre de 2026";

type Section = { icon: SFSymbol; title: string; body: string };

// lo que la app hace de verdad (revisado en el código): sin cuentas, sin servidores, sin analítica.
// Si cambia algo de esto, hay que actualizar el texto y PRIVACY_UPDATED
export const PRIVACY_SECTIONS: readonly Section[] = [
  {
    icon: "iphone",
    title: "Todo se queda en tu teléfono",
    body: "SynthVJ no tiene cuentas ni servidores y no envía tus imágenes, proyectos ni datos de uso a ningún sitio. Tus proyectos se guardan solo en el almacenamiento de la app, en este dispositivo. Si borras la app, se borran con ella.",
  },
  {
    icon: "camera",
    title: "Cámara",
    body: "Se usa solo cuando abres la cámara dentro de la app, para tomar una foto o grabar un clip corto. Lo que capturas va a tu proyecto; no se guarda en Fotos a menos que exportes.",
  },
  {
    icon: "photo.on.rectangle",
    title: "Fotos",
    body: "Al importar, eliges tú qué foto o clip usar; la app solo recibe esa. Al exportar, guarda en Fotos la imagen o el GIF que creaste. No lee el resto de tu biblioteca.",
  },
  {
    icon: "mic",
    title: "Micrófono",
    body: "Se enciende solo si una modulación usa MIC (o un ADSR que se dispara con golpes), mientras el editor está a la vista. El sonido se analiza en el momento para mover los efectos: no se graba, no se guarda y no sale del teléfono.",
  },
  {
    icon: "hand.draw",
    title: "Toques y gestos",
    body: "Los gestos que grabas con el dedo se guardan como un recorrido de puntos dentro de tu proyecto o de tu biblioteca de gestos, en este dispositivo. La app no usa otros sensores del teléfono.",
  },
  {
    icon: "square.and.arrow.up",
    title: "Compartir",
    body: "Solo se comparte lo que tú eliges compartir (una exportación o una receta .synthfx), con la app que tú elijas en la hoja de compartir de iOS. Desde ese momento aplica la privacidad de esa app.",
  },
  {
    icon: "photo",
    title: "Uso de imágenes",
    body: "Las imágenes y clips que usas siguen siendo tuyos, igual que lo que creas con ellos; SynthVJ no reclama ningún derecho sobre ellos. Usa solo material que tengas derecho a usar y respeta la privacidad y la imagen de otras personas: no captures ni compartas a nadie sin su permiso.",
  },
  {
    icon: "exclamationmark.triangle",
    title: "Destellos",
    body: "Algunos efectos y modulaciones producen destellos y patrones que parpadean. La app avisa cuando hay destellos rápidos sobre una zona amplia, pero si tienes sensibilidad a la luz (epilepsia fotosensible), úsala con cuidado.",
  },
  {
    icon: "gearshape",
    title: "Tus permisos",
    body: "Puedes dar o quitar el acceso a la cámara, Fotos y el micrófono cuando quieras en Ajustes de iOS → SynthVJ. Sin un permiso, la app sigue funcionando sin esa función.",
  },
];

type Props = {
  onClose: () => void;
  // en la introducción: el botón principal acepta y continúa
  acceptLabel?: string;
};

// aviso de privacidad completo, en lenguaje claro. Se abre desde la introducción y desde el menú ⋯
// del editor
export function PrivacyNotice({ onClose, acceptLabel }: Props) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} supportedOrientations={[...ALL_ORIENTATIONS]}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Aviso de privacidad
          </Text>
          {!acceptLabel && <IconButton icon="xmark" label="Cerrar el aviso de privacidad" size={34} bare onPress={onClose} />}
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.updated}>ÚLTIMA ACTUALIZACIÓN · {PRIVACY_UPDATED.toUpperCase()}</Text>
          {PRIVACY_SECTIONS.map((s) => (
            <View key={s.title} style={styles.section} accessible accessibilityLabel={`${s.title}. ${s.body}`}>
              <View style={styles.icon}>
                <Icon name={s.icon} size={18} />
              </View>
              <View style={styles.text}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.body}>{s.body}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        {acceptLabel && (
          <View style={styles.bottom}>
            <Button label={acceptLabel} icon="checkmark" onPress={onClose} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm, gap: space.sm },
  title: { flex: 1, color: colors.inkText, fontFamily: type.family, fontSize: type.title, fontWeight: "600" },
  content: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.lg },
  updated: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  section: { flexDirection: "row", gap: space.md },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.inkRaised, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 4 },
  sectionTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600" },
  body: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, lineHeight: 19 },
  bottom: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", paddingHorizontal: space.xl, paddingVertical: space.md },
});
