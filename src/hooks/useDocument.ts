"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getPageCount,
  loadPdf,
  type LoadedPdf,
} from "@/lib/pdf/pdfRenderer";
import {
  getActiveDocumentId,
  getDocumentMetadata,
  getPdfFile,
  requestPersistentStorage,
  saveAnnotations,
  saveDocumentMetadata,
  savePdfFile,
  setActiveDocumentId,
} from "@/lib/storage/indexedDb";
import type { DocumentMetadata } from "@/lib/types";

export interface UseDocumentResult {
  document: DocumentMetadata | null;
  pdf: LoadedPdf | null;
  currentPage: number;
  zoom: number;
  isLoading: boolean;
  isRestoring: boolean;
  error: string | null;
  loadFile: (file: File) => Promise<void>;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const DEFAULT_ZOOM = 1;

function clampZoom(value: number): number {
  const rounded = Math.round(value / ZOOM_STEP) * ZOOM_STEP;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(rounded.toFixed(2))));
}

function createDocumentId(): string {
  return `doc_${Date.now()}`;
}

export function useDocument(): UseDocumentResult {
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<LoadedPdf | null>(null);

  const releasePdf = useCallback(async (doc: LoadedPdf | null) => {
    if (!doc) return;
    if (typeof doc.cleanup === "function") {
      await doc.cleanup();
    }
  }, []);

  useEffect(() => {
    return () => {
      void releasePdf(pdfRef.current);
      pdfRef.current = null;
    };
  }, [releasePdf]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsRestoring(true);
      try {
        void requestPersistentStorage();

        const activeId = await getActiveDocumentId();
        if (cancelled) return;
        if (!activeId) {
          setIsRestoring(false);
          return;
        }

        const [meta, blob] = await Promise.all([
          getDocumentMetadata(activeId),
          getPdfFile(activeId),
        ]);
        if (cancelled) return;

        if (!meta || !blob) {
          console.warn("Saved document incomplete; skipping restore.", {
            activeId,
            hasMeta: Boolean(meta),
            hasBlob: Boolean(blob),
          });
          setIsRestoring(false);
          return;
        }

        await releasePdf(pdfRef.current);
        if (cancelled) return;

        const loaded = await loadPdf(blob);
        if (cancelled) {
          await releasePdf(loaded);
          return;
        }

        pdfRef.current = loaded;
        const page = Math.min(
          Math.max(1, meta.lastOpenedPage || 1),
          meta.pageCount || getPageCount(loaded),
        );

        setPdf(loaded);
        setDocument(meta);
        setCurrentPage(page);
        setZoom(DEFAULT_ZOOM);
        setError(null);
      } catch (err) {
        console.error("Failed to restore saved PDF:", err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to restore saved PDF.",
          );
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [releasePdf]);

  const loadFile = useCallback(
    async (file: File) => {
      if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        setError("Please choose a PDF file.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await releasePdf(pdfRef.current);
        pdfRef.current = null;

        // Clone so IndexedDB keeps a durable Blob (not a live File handle).
        const pdfBlob = file.slice(0, file.size, file.type || "application/pdf");
        const loaded = await loadPdf(pdfBlob);
        pdfRef.current = loaded;

        const pageCount = getPageCount(loaded);
        const meta: DocumentMetadata = {
          id: createDocumentId(),
          name: file.name,
          pageCount,
          fileSize: file.size,
          lastOpenedPage: 1,
          updatedAt: Date.now(),
        };

        await Promise.all([
          savePdfFile(meta.id, pdfBlob),
          saveDocumentMetadata(meta),
          saveAnnotations(meta.id, []),
          setActiveDocumentId(meta.id),
          requestPersistentStorage(),
        ]);

        // Confirm write before treating upload as durable.
        const saved = await getPdfFile(meta.id);
        if (!saved) {
          throw new Error("PDF was not saved to browser storage.");
        }

        setPdf(loaded);
        setDocument(meta);
        setCurrentPage(1);
        setZoom(DEFAULT_ZOOM);
      } catch (err) {
        console.error(err);
        setPdf(null);
        setDocument(null);
        setError(err instanceof Error ? err.message : "Failed to load PDF.");
      } finally {
        setIsLoading(false);
      }
    },
    [releasePdf],
  );

  const pageCount = document?.pageCount ?? 0;

  const setPage = useCallback(
    (page: number) => {
      if (pageCount < 1) return;
      const next = Math.min(Math.max(1, page), pageCount);
      setCurrentPage(next);
      setDocument((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          lastOpenedPage: next,
          updatedAt: Date.now(),
        };
        void saveDocumentMetadata(updated);
        return updated;
      });
    },
    [pageCount],
  );

  const nextPage = useCallback(() => {
    setPage(currentPage + 1);
  }, [currentPage, setPage]);

  const prevPage = useCallback(() => {
    setPage(currentPage - 1);
  }, [currentPage, setPage]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => clampZoom(prev + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => clampZoom(prev - ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  return {
    document,
    pdf,
    currentPage,
    zoom,
    isLoading,
    isRestoring,
    error,
    loadFile,
    setPage,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    resetZoom,
  };
}
