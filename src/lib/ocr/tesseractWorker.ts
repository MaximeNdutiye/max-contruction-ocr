/**
 * Client-side OCR via Tesseract.js (WASM / Web Worker).
 * Singleton worker shared across capture runs.
 */

import type { Worker } from "tesseract.js";
import { PSM } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

/** Letters, digits, and punctuation common on drawings. */
const DRAWING_CHAR_WHITELIST =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'\"-–—./@°#()[]:&+ ";

async function getWorker(): Promise<Worker> {
  if (typeof window === "undefined") {
    throw new Error("OCR is only available in the browser.");
  }

  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: () => undefined,
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
        tessedit_char_whitelist: DRAWING_CHAR_WHITELIST,
      });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }

  return workerPromise;
}

export async function recognizeText(
  image: HTMLCanvasElement | HTMLImageElement | Blob,
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker();
  const result = await worker.recognize(image);
  const text = (result.data.text || "").trim();
  const confidence =
    typeof result.data.confidence === "number" ? result.data.confidence : 0;
  return { text, confidence };
}

export async function terminateWorker(): Promise<void> {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } finally {
    workerPromise = null;
  }
}
