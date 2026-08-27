import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import type { BoundingBox } from "@/lib/types";

export type LoadedPdf = PDFDocumentProxy;

/**
 * Use the legacy build — the modern pdfjs-dist build requires APIs like
 * Map.prototype.getOrInsertComputed that many current browsers still lack.
 */
type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (typeof window === "undefined") {
    throw new Error("PDF rendering is only available in the browser.");
  }

  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    });
  }

  return pdfjsPromise;
}

export async function loadPdf(source: ArrayBuffer | Blob): Promise<LoadedPdf> {
  const pdfjs = await getPdfjs();
  const data =
    source instanceof Blob ? await source.arrayBuffer() : source.slice(0);
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  return loadingTask.promise;
}

export function getPageCount(pdf: LoadedPdf): number {
  return pdf.numPages;
}

export function isRenderCancelled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "RenderingCancelledException" ||
    message.toLowerCase().includes("rendering cancelled") ||
    message.toLowerCase().includes("multiple render()")
  );
}

export type PageRenderHandle = {
  promise: Promise<{ width: number; height: number }>;
  cancel: () => void;
};

/**
 * Renders a PDF page into `canvas`, fitting within `maxWidth * zoom`.
 * Call `cancel()` before starting another render on the same canvas.
 */
export function renderPage(
  pdf: LoadedPdf,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  maxWidth: number,
  zoom = 1,
): PageRenderHandle {
  let cancelled = false;
  let renderTask: RenderTask | null = null;

  const promise = (async () => {
    const page = await pdf.getPage(pageNumber);
    if (cancelled) {
      throw Object.assign(new Error("Rendering cancelled"), {
        name: "RenderingCancelledException",
      });
    }

    const baseViewport = page.getViewport({ scale: 1 });
    const fitWidth = Math.max(1, Math.min(maxWidth, baseViewport.width));
    const cssWidth = Math.max(1, fitWidth * zoom);
    const scale = cssWidth / baseViewport.width;
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssWidth * (baseViewport.height / baseViewport.width)}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not get canvas 2D context");
    }

    if (cancelled) {
      throw Object.assign(new Error("Rendering cancelled"), {
        name: "RenderingCancelledException",
      });
    }

    renderTask = page.render({ canvas, canvasContext: context, viewport });
    await renderTask.promise;

    return {
      width: cssWidth,
      height: cssWidth * (baseViewport.height / baseViewport.width),
    };
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // ignore cancel races
      }
    },
  };
}

/**
 * Rasterize a normalized page region at high DPI for OCR.
 * Independent of the on-screen zoom / fit-width canvas.
 *
 * Crops tightly to `box`. Only a few bitmap pixels of padding are added
 * so glyphs aren't clipped — never a % of the page (that pulls in neighbors).
 */
export async function renderNormalizedRegion(
  pdf: LoadedPdf,
  pageNumber: number,
  box: BoundingBox,
  options: {
    /** PDF user-unit scale. 1 ≈ 72dpi; ~3 ≈ 216dpi. */
    minScale?: number;
    /** Ensure the crop is at least this many pixels on the short side. */
    minCropPx?: number;
    /** Extra pixels around the box at the rendered resolution (default 2). */
    paddingPx?: number;
  } = {},
): Promise<HTMLCanvasElement> {
  const minScale = options.minScale ?? 3;
  const minCropPx = options.minCropPx ?? 96;
  const paddingPx = options.paddingPx ?? 2;

  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });

  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(1, box.x + box.width);
  const y1 = Math.min(1, box.y + box.height);
  const normW = Math.max(0.001, x1 - x0);
  const normH = Math.max(0.001, y1 - y0);

  const scaleForSize = Math.max(
    minCropPx / (normW * base.width),
    minCropPx / (normH * base.height),
  );
  const scale = Math.min(5, Math.max(minScale, scaleForSize));
  const viewport = page.getViewport({ scale });

  const full = document.createElement("canvas");
  full.width = Math.ceil(viewport.width);
  full.height = Math.ceil(viewport.height);
  const fullCtx = full.getContext("2d");
  if (!fullCtx) {
    throw new Error("Could not get OCR render context");
  }

  // White background — transparent PDF regions become black otherwise.
  fullCtx.fillStyle = "#ffffff";
  fullCtx.fillRect(0, 0, full.width, full.height);

  await page.render({
    canvas: full,
    canvasContext: fullCtx,
    viewport,
  }).promise;

  const sx = Math.max(0, Math.floor(x0 * full.width) - paddingPx);
  const sy = Math.max(0, Math.floor(y0 * full.height) - paddingPx);
  const ex = Math.min(full.width, Math.ceil(x1 * full.width) + paddingPx);
  const ey = Math.min(full.height, Math.ceil(y1 * full.height) + paddingPx);
  const sw = Math.max(1, ex - sx);
  const sh = Math.max(1, ey - sy);

  const crop = document.createElement("canvas");
  crop.width = sw;
  crop.height = sh;
  const cropCtx = crop.getContext("2d");
  if (!cropCtx) {
    throw new Error("Could not get OCR crop context");
  }
  cropCtx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
  return crop;
}
