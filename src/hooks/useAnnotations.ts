"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAnnotations, saveAnnotations } from "@/lib/storage/indexedDb";
import type { Annotation, AnnotationType, BoundingBox } from "@/lib/types";

export type InteractionMode = "pan" | "capture" | "ignore";

const MIN_NORM_SIZE = 0.005;
const MAX_HISTORY = 50;
const PERSIST_DEBOUNCE_MS = 200;

export interface UseAnnotationsResult {
  annotations: Annotation[];
  pageAnnotations: Annotation[];
  mode: InteractionMode;
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  isHydrating: boolean;
  setMode: (mode: InteractionMode) => void;
  selectAnnotation: (id: string | null) => void;
  addAnnotation: (
    documentId: string,
    pageNumber: number,
    type: AnnotationType,
    box: BoundingBox,
  ) => Annotation | null;
  updateAnnotation: (
    id: string,
    patch: Partial<
      Pick<Annotation, "ocrStatus" | "extractedText" | "ocrConfidence">
    >,
  ) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  undo: () => void;
  redo: () => void;
}

type HistoryState = {
  past: Annotation[][];
  present: Annotation[];
  future: Annotation[][];
};

function createAnnotationId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBox(box: BoundingBox): BoundingBox {
  const x = Math.min(box.x, box.x + box.width);
  const y = Math.min(box.y, box.y + box.height);
  const width = Math.abs(box.width);
  const height = Math.abs(box.height);
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    width: Math.min(1 - Math.min(1, Math.max(0, x)), Math.max(0, width)),
    height: Math.min(1 - Math.min(1, Math.max(0, y)), Math.max(0, height)),
  };
}

function commit(history: HistoryState, next: Annotation[]): HistoryState {
  const past = [...history.past, history.present].slice(-MAX_HISTORY);
  return {
    past,
    present: next,
    future: [],
  };
}

export function useAnnotations(
  documentId: string | null,
  pageNumber: number,
): UseAnnotationsResult {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: [],
    future: [],
  });
  const [mode, setMode] = useState<InteractionMode>("pan");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);
  const skipPersistRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annotations = history.present;
  const presentRef = useRef(annotations);
  presentRef.current = annotations;

  const pageAnnotations = useMemo(
    () =>
      annotations.filter(
        (annotation) =>
          annotation.documentId === documentId &&
          annotation.pageNumber === pageNumber,
      ),
    [annotations, documentId, pageNumber],
  );

  // Hydrate annotations whenever the active document changes.
  useEffect(() => {
    let cancelled = false;

    if (!documentId) {
      skipPersistRef.current = true;
      setHistory({ past: [], present: [], future: [] });
      setSelectedId(null);
      setIsHydrating(false);
      return;
    }

    setIsHydrating(true);
    skipPersistRef.current = true;

    void (async () => {
      try {
        const stored = await getAnnotations(documentId);
        if (cancelled) return;
        setHistory({ past: [], present: stored, future: [] });
        setSelectedId(null);
        setMode("pan");
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setHistory({ past: [], present: [], future: [] });
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
          // Allow the next present change (user edits) to persist.
          queueMicrotask(() => {
            if (!cancelled) skipPersistRef.current = false;
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      // Flush pending edits for the document we're leaving so a fast
      // PDF switch doesn't drop boxes still in the debounce window.
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (!skipPersistRef.current) {
        void saveAnnotations(documentId, presentRef.current).catch((err) => {
          console.error(err);
        });
      }
    };
  }, [documentId]);

  // Debounced persist of the current annotation list.
  useEffect(() => {
    if (!documentId || isHydrating || skipPersistRef.current) return;

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void saveAnnotations(documentId, history.present).catch((err) => {
        console.error(err);
      });
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [documentId, history.present, isHydrating]);

  const addAnnotation = useCallback(
    (
      docId: string,
      page: number,
      type: AnnotationType,
      box: BoundingBox,
    ): Annotation | null => {
      const normalized = normalizeBox(box);
      if (normalized.width < MIN_NORM_SIZE || normalized.height < MIN_NORM_SIZE) {
        return null;
      }

      const annotation: Annotation = {
        id: createAnnotationId(),
        documentId: docId,
        pageNumber: page,
        type,
        ...normalized,
        ocrStatus: type === "capture" ? "processing" : "idle",
        createdAt: Date.now(),
      };

      setHistory((prev) => commit(prev, [...prev.present, annotation]));
      setSelectedId(annotation.id);
      return annotation;
    },
    [],
  );

  /** Soft patch (OCR status/text) — does not create an undo step. */
  const updateAnnotation = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<Annotation, "ocrStatus" | "extractedText" | "ocrConfidence">
      >,
    ) => {
      setHistory((prev) => ({
        ...prev,
        present: prev.present.map((annotation) =>
          annotation.id === id ? { ...annotation, ...patch } : annotation,
        ),
      }));
    },
    [],
  );

  const removeAnnotation = useCallback((id: string) => {
    setHistory((prev) => {
      if (!prev.present.some((annotation) => annotation.id === id)) return prev;
      return commit(
        prev,
        prev.present.filter((annotation) => annotation.id !== id),
      );
    });
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const clearAnnotations = useCallback(() => {
    setHistory({ past: [], present: [], future: [] });
    setSelectedId(null);
  }, []);

  const selectAnnotation = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
    setSelectedId(null);
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const [next, ...rest] = prev.future;
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: rest,
      };
    });
    setSelectedId(null);
  }, []);

  return {
    annotations,
    pageAnnotations,
    mode,
    selectedId,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    isHydrating,
    setMode,
    selectAnnotation,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    clearAnnotations,
    undo,
    redo,
  };
}
