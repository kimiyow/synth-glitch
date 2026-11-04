import { File, Paths } from "expo-file-system";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { shareAsync } from "expo-sharing";

/** Escribe un archivo exportado en la caché (para guardarlo en Fotos o compartirlo). */
export function writeExportFile(fileName: string, bytes: Uint8Array): string {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.writeSync(bytes);
  return file.uri;
}

/** Guarda en Fotos (EXP-01, EXP-02). Pide solo permiso de escritura (CAM-01). */
export async function saveToPhotos(uri: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) return { ok: false, error: "SIN PERMISO PARA GUARDAR EN FOTOS · ACTÍVALO EN AJUSTES" };
  await Asset.create(uri);
  return { ok: true };
}

/** EXP-04: hoja de compartir con un archivo ya exportado. */
export async function shareFile(uri: string): Promise<void> {
  await shareAsync(uri);
}
