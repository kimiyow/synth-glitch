/** Tipos mínimos de gifenc 1.0.3 (la librería no trae los suyos). */
declare module "gifenc" {
  export type Format = "rgb565" | "rgb444" | "rgba4444";
  export type Palette = number[][];
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: Format }): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: Format): Uint8Array;
  export type Encoder = {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: Palette; delay?: number; repeat?: number; first?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): Encoder;
}
