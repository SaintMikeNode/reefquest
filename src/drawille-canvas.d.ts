// Minimal types for drawille-canvas (a Canvas-like 2D context that rasterizes into braille cells).
declare module "drawille-canvas/index.js" {
  export default class DrawilleCanvas {
    constructor(width: number, height: number);
    width: number;
    height: number;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    closePath(): void;
    stroke(): void;
    fill(): void;
    /** The frame as text: braille characters (U+2800–U+28FF), spaces for empty cells, rows ending in "\n". */
    toString(): string;
  }
}
