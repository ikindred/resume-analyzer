/**
 * pdfjs-dist (via pdf-parse) expects browser globals. On Node/Vercel they are missing,
 * which breaks module evaluation (e.g. `new DOMMatrix()` at import time).
 * Import this module before any `pdf-parse` / `pdfjs-dist` import.
 */
import DOMMatrixShim from "dommatrix";

const g = globalThis as Record<string, unknown>;

if (typeof globalThis.DOMMatrix === "undefined") {
  g.DOMMatrix = DOMMatrixShim;
}
if (typeof (globalThis as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly === "undefined") {
  g.DOMMatrixReadOnly = DOMMatrixShim;
}

if (typeof globalThis.ImageData === "undefined") {
  g.ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(
      swOrData: number | Uint8ClampedArray,
      shOrWidth?: number,
      sh?: number,
    ) {
      if (swOrData instanceof Uint8ClampedArray) {
        this.data = swOrData;
        this.width = shOrWidth ?? 0;
        this.height = sh ?? 0;
      } else {
        this.width = swOrData;
        this.height = shOrWidth ?? 0;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  } as typeof ImageData;
}

if (typeof globalThis.Path2D === "undefined") {
  g.Path2D = class Path2D {
    addPath(): void {}
    closePath(): void {}
    moveTo(): void {}
    lineTo(): void {}
    bezierCurveTo(): void {}
    quadraticCurveTo(): void {}
    rect(): void {}
    roundRect(): void {}
    arc(): void {}
    ellipse(): void {}
    arcTo(): void {}
  } as unknown as typeof Path2D;
}
