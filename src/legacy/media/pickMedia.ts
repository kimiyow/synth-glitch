import * as ImagePicker from "expo-image-picker";

import {
  MAX_IMPORTED_CLIP_DURATION_MS,
  resolvePickedAsset,
  type MediaPickerResult,
} from "./resolvePickedAsset";

export async function pickMediaFromLibrary(): Promise<MediaPickerResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      kind: "rejected",
      message: "PERMISO DENEGADO · ACTIVA EL ACCESO A FOTOS",
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    videoMaxDuration: MAX_IMPORTED_CLIP_DURATION_MS / 1000,
  });

  if (result.canceled) {
    return { kind: "cancelled" };
  }

  const asset = result.assets[0];
  if (!asset) {
    throw new Error("El selector de Fotos no devolvió ningún archivo.");
  }

  return resolvePickedAsset(asset);
}
