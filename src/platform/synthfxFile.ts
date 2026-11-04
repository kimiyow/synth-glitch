import { getDocumentAsync } from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { shareAsync } from "expo-sharing";

import { SYNTHFX_MAX_BYTES } from "../project/synthfx";

/**
 * Adaptadores de `.synthfx` (SEN-05): hoja de compartir y selector de documentos.
 * Sin mimeType ni UTI: en iOS añadirían otra extensión (`escena.synthfx.json`).
 */
export async function shareSynthFxFile(fileName: string, text: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.writeSync(text);
  await shareAsync(file.uri);
}

export type PickedSynthFx = { kind: "canceled" } | { kind: "rejected"; message: string } | { kind: "picked"; text: string };

/** Abre el selector de documentos; el tamaño se revisa antes de leer (NFR-12). */
export async function pickSynthFxFile(): Promise<PickedSynthFx> {
  const result = await getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
  if (result.canceled) return { kind: "canceled" };
  const asset = result.assets[0];
  if (!asset.name.toLowerCase().endsWith(".synthfx") && !asset.name.toLowerCase().endsWith(".json")) {
    return { kind: "rejected", message: "ELIGE UN ARCHIVO .SYNTHFX" };
  }
  const file = new File(asset.uri);
  const size = asset.size ?? file.size;
  if (size > SYNTHFX_MAX_BYTES) return { kind: "rejected", message: "ARCHIVO DEMASIADO GRANDE · MÁXIMO 200 KB" };
  return { kind: "picked", text: file.textSync() };
}
