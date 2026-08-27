"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AnnotationOverlay } from "@/components/annotations/AnnotationOverlay";
import { AnnotationToolbar } from "@/components/annotations/AnnotationToolbar";
import { AppShell } from "@/components/layout/AppShell";
import { Toolbar } from "@/components/layout/Toolbar";
import { OcrInspector } from "@/components/ocr/OcrInspector";
import { PageThumbnails } from "@/components/pdf/PageThumbnails";
import { PdfUploader } from "@/components/pdf/PdfUploader";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { ZoomControls } from "@/components/pdf/ZoomControls";
import {
  useAnnotations,
  type InteractionMode,
} from "@/hooks/useAnnotations";
import { useDocument } from "@/hooks/useDocument";
import { prepareOcrImage } from "@/lib/ocr/prepareOcrImage";
import { recognizeText } from "@/lib/ocr/tesseractWorker";
import type { Annotation, AnnotationType, BoundingBox } from "@/lib/types";

const MODE_SHORTCUTS: Record<string, InteractionMode> = {
  v: "pan",
  c: "capture",
  i: "ignore",
};

export function DocumentWorkspace() {
  const {
    document,
    pdf,
    currentPage,
    zoom,
    isLoading,
    isRestoring,
    error,
    loadFile,
    setPage,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useDocument();

  const {
    annotations,
    pageAnnotations,
    mode,
    selectedId,
    canUndo,
    canRedo,
    setMode,
    selectAnnotation,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    undo,
    redo,
  } = useAnnotations(document?.id ?? null, currentPage);

  const [pagesOpen, setPagesOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ocrJobsRef = useRef(new Set<string>());

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    pageCanvasRef.current = canvas;
  }, []);

  const runOcrForAnnotation = useCallback(
    async (annotation: Annotation) => {
      if (annotation.type !== "capture") return;
      if (ocrJobsRef.current.has(annotation.id)) return;

      ocrJobsRef.current.add(annotation.id);
      updateAnnotation(annotation.id, { ocrStatus: "processing" });

      try {
        const ignoreBoxes = annotations
          .filter(
            (item) =>
              item.type === "ignore" &&
              item.pageNumber === annotation.pageNumber &&
              item.id !== annotation.id,
          )
          .map((item) => ({
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
          }));

        const image = await prepareOcrImage({
          pdf,
          pageNumber: annotation.pageNumber,
          box: annotation,
          ignoreBoxes,
          screenCanvas: pageCanvasRef.current,
        });
        const { text, confidence } = await recognizeText(image);
        updateAnnotation(annotation.id, {
          ocrStatus: "completed",
          extractedText: text,
          ocrConfidence: confidence,
        });
      } catch (err) {
        console.error(err);
        updateAnnotation(annotation.id, {
          ocrStatus: "error",
          extractedText: "",
        });
      } finally {
        ocrJobsRef.current.delete(annotation.id);
      }
    },
    [annotations, pdf, updateAnnotation],
  );

  const handleCreate = useCallback(
    (
      documentId: string,
      pageNumber: number,
      type: AnnotationType,
      box: BoundingBox,
    ) => {
      const created = addAnnotation(documentId, pageNumber, type, box);
      if (!created || created.type !== "capture") return;
      void runOcrForAnnotation(created);
    },
    [addAnnotation, runOcrForAnnotation],
  );

  const handleRerun = useCallback(
    (id: string) => {
      const annotation = annotations.find((item) => item.id === id);
      if (!annotation) return;
      if (annotation.pageNumber !== currentPage) {
        setPage(annotation.pageNumber);
      }
      void runOcrForAnnotation(annotation);
    },
    [annotations, currentPage, runOcrForAnnotation, setPage],
  );

  // Auto-open OCR panel when a capture region is created.
  useEffect(() => {
    if (selectedId) {
      const selected = annotations.find((item) => item.id === selectedId);
      if (selected?.type === "capture") setInspectorOpen(true);
    }
  }, [selectedId, annotations]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }

      const nextMode = MODE_SHORTCUTS[event.key.toLowerCase()];
      if (nextMode && document) {
        event.preventDefault();
        setMode(nextMode);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [document, setMode, undo, redo]);

  const captureAnnotations = annotations.filter(
    (annotation) => annotation.type === "capture",
  );

  return (
    <AppShell
      pagesOpen={pagesOpen}
      inspectorOpen={inspectorOpen}
      onTogglePages={() => setPagesOpen((open) => !open)}
      onToggleInspector={() => setInspectorOpen((open) => !open)}
      toolbar={
        <Toolbar>
          <PdfUploader
            onFileSelected={loadFile}
            disabled={isLoading || isRestoring}
            fileName={document?.name}
          />
          {document ? (
            <span className="text-xs tabular-nums text-zinc-500">
              Page {currentPage} of {document.pageCount}
            </span>
          ) : null}
          <ZoomControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetZoom}
            disabled={!document || isLoading || isRestoring}
          />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagesOpen((open) => !open)}
              className={`rounded border px-2 py-1 text-xs ${
                pagesOpen
                  ? "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-zinc-200 text-zinc-500 dark:border-zinc-700"
              }`}
              aria-pressed={pagesOpen}
            >
              Pages
            </button>
            <button
              type="button"
              onClick={() => setInspectorOpen((open) => !open)}
              className={`rounded border px-2 py-1 text-xs ${
                inspectorOpen
                  ? "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-zinc-200 text-zinc-500 dark:border-zinc-700"
              }`}
              aria-pressed={inspectorOpen}
            >
              OCR
            </button>
          </div>
        </Toolbar>
      }
      pages={
        <PageThumbnails
          pdf={pdf}
          pageCount={document?.pageCount ?? 0}
          currentPage={currentPage}
          onSelectPage={setPage}
        />
      }
      viewer={
        <PdfViewer
          pdf={pdf}
          pageNumber={currentPage}
          zoom={zoom}
          isLoading={isLoading || isRestoring}
          error={error}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          panEnabled={mode === "pan"}
          onCanvasReady={handleCanvasReady}
          chrome={
            <AnnotationToolbar
              mode={mode}
              onModeChange={setMode}
              selectedId={selectedId}
              onDeleteSelected={() => {
                if (selectedId) removeAnnotation(selectedId);
              }}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              disabled={!document || isLoading || isRestoring}
            />
          }
          overlay={
            <AnnotationOverlay
              annotations={pageAnnotations}
              mode={mode}
              selectedId={selectedId}
              documentId={document?.id ?? null}
              pageNumber={currentPage}
              onSelect={selectAnnotation}
              onCreate={handleCreate}
              onDelete={removeAnnotation}
            />
          }
        />
      }
      inspector={
        <OcrInspector
          annotations={captureAnnotations}
          selectedId={selectedId}
          onSelect={selectAnnotation}
          onRerun={handleRerun}
        />
      }
    />
  );
}
