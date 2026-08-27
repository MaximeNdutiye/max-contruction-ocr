/** Shared domain types for documents, annotations, and OCR. */

export type AnnotationType = "capture" | "ignore";

export type OCRStatus = "idle" | "processing" | "completed" | "error";

export interface BoundingBox {
  /** Normalized X (0.0 to 1.0) */
  x: number;
  /** Normalized Y (0.0 to 1.0) */
  y: number;
  /** Normalized Width (0.0 to 1.0) */
  width: number;
  /** Normalized Height (0.0 to 1.0) */
  height: number;
}

export interface Annotation extends BoundingBox {
  id: string;
  documentId: string;
  pageNumber: number;
  type: AnnotationType;
  label?: string;
  extractedText?: string;
  ocrStatus: OCRStatus;
  ocrConfidence?: number;
  createdAt: number;
}

export interface DocumentMetadata {
  id: string;
  name: string;
  pageCount: number;
  fileSize: number;
  lastOpenedPage: number;
  updatedAt: number;
}
