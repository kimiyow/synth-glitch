import * as ImagePicker from "expo-image-picker";

import { MAX_IMPORTED_CLIP_DURATION_MS, resolvePickedAsset, type MediaPickerResult } from "./resolvePickedAsset";

/**
 * Selector de Fotos (CAM-05). `Compatible` hace que iOS entregue JPEG/H.264 en lugar
 * de HEIC/HEVC. El selector del sistema no necesita permiso de lectura de la galería.
 */
export async function pickMediaFromLibrary(): Promise<MediaPickerResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return { kind: "cancelled" };
  const asset = result.assets[0];
  if (!asset) return { kind: "rejected", message: "NO SE RECIBIÓ NINGÚN ARCHIVO" };
  return resolvePickedAsset(asset);
}

export { MAX_IMPORTED_CLIP_DURATION_MS };
