import { describe, expect, it } from "@jest/globals";

import {
  MAX_IMPORTED_CLIP_DURATION_MS,
  resolvePickedAsset,
} from "./resolvePickedAsset";

const videoAsset = { uri: "file:///clip.mp4", width: 1920, height: 1080, type: "video" as const };

describe("resolvePickedAsset", () => {
  it("accepts videos up to and including ten seconds", () => {
    expect(
      resolvePickedAsset({
        ...videoAsset,
        duration: MAX_IMPORTED_CLIP_DURATION_MS,
      }),
    ).toMatchObject({
      kind: "selected",
      media: { uri: videoAsset.uri, type: "clip" },
    });
  });

  it("rejects videos over ten seconds", () => {
    expect(
      resolvePickedAsset({
        ...videoAsset,
        duration: MAX_IMPORTED_CLIP_DURATION_MS + 1,
      }),
    ).toMatchObject({ kind: "rejected", message: "VIDEO MUY LARGO · EL MÁXIMO ES 10 S" });
  });

  it("rejects videos without a valid duration", () => {
    expect(
      resolvePickedAsset({ ...videoAsset, duration: null }),
    ).toMatchObject({ kind: "rejected" });
  });

  it("returns image assets as photos", () => {
    expect(
      resolvePickedAsset({
        uri: "file:///photo.jpg",
        width: 1200,
        height: 800,
        type: "image",
        duration: null,
      }),
    ).toMatchObject({
      kind: "selected",
      media: { uri: "file:///photo.jpg", type: "photo" },
    });
  });
});
