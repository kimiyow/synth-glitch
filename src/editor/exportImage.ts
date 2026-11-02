import React from "react";

import {
  ImageFormat,
  ImageShader,
  Rect,
  Shader,
  Skia,
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

  const scale = Math.min(
    1,
    MAX_EXPORT_SIDE / Math.max(sourceImage.width(), sourceImage.height()),
  );
  const width = Math.max(1, Math.round(sourceImage.width() * scale));
  const height = Math.max(1, Math.round(sourceImage.height() * scale));
  const rect = { x: 0, y: 0, width, height };

  const visibleLayers = args.layers.filter((layer) => layer.visible);
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
      rect,
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
}
