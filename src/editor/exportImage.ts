import React from "react";

import {
  ImageFormat,
  ImageShader,
  Rect,
  Shader,
  Skia,
  type SkImage,
  drawAsImage,
} from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";

import { getRuntimeEffect } from "../effects/registry";
import type { Layer } from "../state/types";

const MAX_EXPORT_SIDE = 4096;

export type ExportedPhoto = {
  uri: string;
  width: number;
  height: number;
};

export async function exportEffectedPhoto(args: {
  sourceUri: string;
  layers: Layer[];
}): Promise<ExportedPhoto> {
  const sourceData = await Skia.Data.fromURI(args.sourceUri);
  const sourceImage = Skia.Image.MakeImageFromEncoded(sourceData);

  if (!sourceImage) {
    throw new Error("Skia no pudo decodificar la foto de origen.");
  }

  return renderEffectedImage(sourceImage, args.layers, 0);
}

export async function exportEffectedFrame(args: {
  sourceImage: SkImage | null;
  layers: Layer[];
  rotation: 0 | 90 | 180 | 270;
}): Promise<ExportedPhoto> {
  if (!args.sourceImage) {
    throw new Error("Skia todavía no tiene un fotograma disponible del clip.");
  }

  const stableImage = args.sourceImage.makeNonTextureImage();
  if (!stableImage) {
    throw new Error("Skia no pudo conservar el fotograma actual del clip.");
  }

  try {
    return await renderEffectedImage(stableImage, args.layers, args.rotation);
  } finally {
    stableImage.dispose();
  }
}

async function renderEffectedImage(
  sourceImage: SkImage,
  layers: Layer[],
  rotation: 0 | 90 | 180 | 270,
): Promise<ExportedPhoto> {
  const isQuarterTurn = rotation === 90 || rotation === 270;
  const sourceWidth = isQuarterTurn ? sourceImage.height() : sourceImage.width();
  const sourceHeight = isQuarterTurn ? sourceImage.width() : sourceImage.height();
  const scale = Math.min(
    1,
    MAX_EXPORT_SIDE / Math.max(sourceWidth, sourceHeight),
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const rect = { x: 0, y: 0, width, height };
  const imageRect = isQuarterTurn
    ? {
        x: (width - height) / 2,
        y: (height - width) / 2,
        width: height,
        height: width,
      }
    : rect;
  const imageShaderTransform =
    rotation === 0 ? undefined : [{ rotateZ: (rotation * Math.PI) / 180 }];
  const imageShaderOrigin =
    rotation === 0 ? undefined : { x: width / 2, y: height / 2 };

  const visibleLayers = layers.filter((layer) => layer.visible);
  const shaderTree = visibleLayers.reduce<React.ReactElement>(
    (child, layer) => {
      const effect = getRuntimeEffect(layer.effect);
      if (!effect) {
        throw new Error(`No se pudo compilar el efecto "${layer.effect}" para exportarlo.`);
      }

      return React.createElement(
        Shader,
        {
          source: effect,
          uniforms: {
            resolution: [width, height],
            param: [layer.params.x, layer.params.y],
            time: 0,
          },
        },
        child,
      );
    },
    React.createElement(ImageShader, {
      image: sourceImage,
      fit: "contain",
      origin: imageShaderOrigin,
      rect: imageRect,
      transform: imageShaderTransform,
    }),
  );
  const element = React.createElement(
    Rect,
    rect,
    shaderTree,
  );

  const renderedImage = await drawAsImage(element, { width, height });
  if (!renderedImage) {
    throw new Error("Skia no pudo renderizar la foto con el efecto.");
  }

  try {
    const encoded = renderedImage.encodeToBytes(ImageFormat.JPEG, 100);
    if (encoded.length === 0) {
      throw new Error("Skia no pudo codificar la foto exportada como JPEG.");
    }

    const file = new File(
      Paths.cache,
      `synth-vj-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
    );
    file.create();
    file.write(encoded);

    return { uri: file.uri, width, height };
  } finally {
    renderedImage.dispose();
  }
}
