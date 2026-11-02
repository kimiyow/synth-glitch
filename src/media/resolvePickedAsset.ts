import type { ImagePickerAsset } from "expo-image-picker";

import type { ActiveMedia } from "../state/editorStore";

export const MAX_IMPORTED_CLIP_DURATION_MS = 10_000;

export type MediaPickerResult =
  | { kind: "cancelled" }
  | { kind: "selected"; media: ActiveMedia }
  | { kind: "rejected"; message: string };

type PickedAsset = Pick<
  ImagePickerAsset,
  "uri" | "width" | "height" | "type" | "mimeType" | "duration"
>;

export function resolvePickedAsset(asset: PickedAsset): MediaPickerResult {
  const mediaType =
    asset.type ??
    (asset.mimeType?.startsWith("video/")
      ? "video"
      : asset.mimeType?.startsWith("image/")
        ? "image"
        : null);

  if (mediaType === "video") {
    if (asset.duration == null || !Number.isFinite(asset.duration) || asset.duration <= 0) {
      return {
        kind: "rejected",
        message: "NO SE PUDO LEER LA DURACIÓN DEL VIDEO",
      };
    }
    if (asset.duration > MAX_IMPORTED_CLIP_DURATION_MS) {
      return {
        kind: "rejected",
        message: "VIDEO MUY LARGO · EL MÁXIMO ES 10 S",
      };
    }

    return {
      kind: "selected",
      media: {
        uri: asset.uri,
        type: "clip",
        width: asset.width,
        height: asset.height,
      },
    };
  }

  if (mediaType !== "image") {
    return {
      kind: "rejected",
      message: "FORMATO NO COMPATIBLE · ELIGE UNA FOTO O UN VIDEO",
    };
  }

  return {
    kind: "selected",
    media: {
      uri: asset.uri,
      type: "photo",
      width: asset.width,
      height: asset.height,
    },
  };
}
