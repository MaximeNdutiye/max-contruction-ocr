/**
 * Crop a normalized page region from a rendered canvas.
 */

import type { BoundingBox } from "@/lib/types";

export function cropNormalizedRegion(
  source: HTMLCanvasElement,
  box: BoundingBox,
): HTMLCanvasElement {
  const sx = Math.max(0, Math.floor(box.x * source.width));
  const sy = Math.max(0, Math.floor(box.y * source.height));
  const sw = Math.max(1, Math.ceil(box.width * source.width));
  const sh = Math.max(1, Math.ceil(box.height * source.height));
  const width = Math.min(sw, source.width - sx);
  const height = Math.min(sh, source.height - sy);

  const crop = document.createElement("canvas");
  crop.width = Math.max(1, width);
  crop.height = Math.max(1, height);

  const ctx = crop.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get crop canvas context");
  }

  ctx.drawImage(source, sx, sy, width, height, 0, 0, width, height);
  return crop;
}

/** Paint overlapping ignore regions white inside a capture crop. */
export function maskIgnoreRegions(
  canvas: HTMLCanvasElement,
  cropBox: BoundingBox,
  ignoreBoxes: BoundingBox[],
): void {
  if (ignoreBoxes.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  for (const ignore of ignoreBoxes) {
    const ix0 = Math.max(cropBox.x, ignore.x);
    const iy0 = Math.max(cropBox.y, ignore.y);
    const ix1 = Math.min(cropBox.x + cropBox.width, ignore.x + ignore.width);
    const iy1 = Math.min(cropBox.y + cropBox.height, ignore.y + ignore.height);
    if (ix1 <= ix0 || iy1 <= iy0) continue;

    const sx = ((ix0 - cropBox.x) / cropBox.width) * canvas.width;
    const sy = ((iy0 - cropBox.y) / cropBox.height) * canvas.height;
    const sw = ((ix1 - ix0) / cropBox.width) * canvas.width;
    const sh = ((iy1 - iy0) / cropBox.height) * canvas.height;
    ctx.fillRect(sx, sy, sw, sh);
  }
}
