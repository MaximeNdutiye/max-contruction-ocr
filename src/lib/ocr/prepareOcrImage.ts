/**
 * Build an image for OCR: crop the capture box (and blank out ignore regions).
 */

import { cropNormalizedRegion, maskIgnoreRegions } from "@/lib/ocr/cropRegion";
import {
  renderNormalizedRegion,
  type LoadedPdf,
} from "@/lib/pdf/pdfRenderer";
import type { BoundingBox } from "@/lib/types";

export async function prepareOcrImage(options: {
  pdf: LoadedPdf | null;
  pageNumber: number;
  box: BoundingBox;
  ignoreBoxes?: BoundingBox[];
  screenCanvas?: HTMLCanvasElement | null;
}): Promise<HTMLCanvasElement> {
  const { pdf, pageNumber, box, ignoreBoxes = [], screenCanvas } = options;

  let crop: HTMLCanvasElement;

  if (pdf) {
    crop = await renderNormalizedRegion(pdf, pageNumber, box);
  } else if (screenCanvas) {
    crop = cropNormalizedRegion(screenCanvas, box);
  } else {
    throw new Error("No PDF or canvas available for OCR.");
  }

  maskIgnoreRegions(crop, box, ignoreBoxes);
  return crop;
}
