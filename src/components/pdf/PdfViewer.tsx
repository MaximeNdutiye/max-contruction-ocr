"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  isRenderCancelled,
  renderPage,
  type LoadedPdf,
} from "@/lib/pdf/pdfRenderer";

type PdfViewerProps = {
  pdf: LoadedPdf | null;
  pageNumber: number;
  zoom?: number;
  isLoading?: boolean;
  error?: string | null;
  overlay?: React.ReactNode;
  /** Fixed UI chrome over the viewport (does not scroll with the page). */
  chrome?: React.ReactNode;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  /** When false, click-drag pan is disabled (annotation drawing owns the pointer). */
  panEnabled?: boolean;
  /** Latest rendered page canvas (for OCR crops). */
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
};

export function PdfViewer({
  pdf,
  pageNumber,
  zoom = 1,
  isLoading = false,
  error = null,
  overlay,
  chrome,
  onZoomIn,
  onZoomOut,
  panEnabled = true,
  onCanvasReady,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !container || !canvas) return;

    let cancelled = false;
    let renderGeneration = 0;
    let lastWidth = 0;
    let lastZoom = zoom;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let activeRender: ReturnType<typeof renderPage> | null = null;

    const run = async (force = false) => {
      const width = Math.max(320, container.clientWidth - 48);
      if (
        !force &&
        Math.abs(width - lastWidth) < 2 &&
        Math.abs(zoom - lastZoom) < 0.001
      ) {
        return;
      }
      lastWidth = width;
      lastZoom = zoom;

      const id = ++renderGeneration;
      activeRender?.cancel();
      activeRender = null;

      setIsRendering(true);
      setRenderError(null);

      const handle = renderPage(pdf, pageNumber, canvas, width, zoom);
      activeRender = handle;

      try {
        await handle.promise;
        if (cancelled || id !== renderGeneration) return;
        onCanvasReady?.(canvas);
      } catch (err) {
        if (cancelled || id !== renderGeneration || isRenderCancelled(err)) return;
        console.error(err);
        setRenderError(err instanceof Error ? err.message : "Failed to render page.");
      } finally {
        if (activeRender === handle) activeRender = null;
        if (!cancelled && id === renderGeneration) {
          setIsRendering(false);
        }
      }
    };

    void run(true);

    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        void run();
      }, 100);
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      activeRender?.cancel();
      observer.disconnect();
      onCanvasReady?.(null);
    };
  }, [pdf, pageNumber, zoom, onCanvasReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (event: WheelEvent) => {
      if (event.metaKey || event.ctrlKey) {
        if (!onZoomIn || !onZoomOut) return;
        event.preventDefault();
        if (event.deltaY < 0) onZoomIn();
        else if (event.deltaY > 0) onZoomOut();
        return;
      }

      // Trackpad / mouse wheel pans the canvas without showing scrollbars.
      event.preventDefault();
      container.scrollLeft += event.deltaX;
      container.scrollTop += event.deltaY;
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [onZoomIn, onZoomOut]);

  const endPan = useCallback((pointerId?: number) => {
    const container = containerRef.current;
    const pan = panRef.current;
    if (!pan) return;
    if (pointerId !== undefined && pan.pointerId !== pointerId) return;

    if (container?.hasPointerCapture(pan.pointerId)) {
      container.releasePointerCapture(pan.pointerId);
    }
    panRef.current = null;
    setIsPanning(false);
  }, []);

  const [modifierPan, setModifierPan] = useState(false);

  useEffect(() => {
    const syncModifier = (event: KeyboardEvent | MouseEvent) => {
      setModifierPan(event.ctrlKey || event.metaKey);
    };
    const clearModifier = () => setModifierPan(false);

    window.addEventListener("keydown", syncModifier);
    window.addEventListener("keyup", syncModifier);
    window.addEventListener("blur", clearModifier);
    return () => {
      window.removeEventListener("keydown", syncModifier);
      window.removeEventListener("keyup", syncModifier);
      window.removeEventListener("blur", clearModifier);
    };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const allowPan = panEnabled || event.ctrlKey || event.metaKey;
      if (!pdf || !allowPan || event.button !== 0) return;
      // Ignore non-primary multi-touch points.
      if (!event.isPrimary) return;

      const container = containerRef.current;
      if (!container) return;

      panRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      container.setPointerCapture(event.pointerId);
      setIsPanning(true);
      event.preventDefault();
    },
    [pdf, panEnabled],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const container = containerRef.current;
    if (!pan || !container || pan.pointerId !== event.pointerId) return;

    const dx = event.clientX - pan.lastX;
    const dy = event.clientY - pan.lastY;
    pan.lastX = event.clientX;
    pan.lastY = event.clientY;

    container.scrollLeft -= dx;
    container.scrollTop -= dy;
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      endPan(event.pointerId);
    },
    [endPan],
  );

  const showEmpty = !pdf && !isLoading && !error;
  const statusMessage = error || renderError;
  const canPan = Boolean(pdf && !statusMessage && (panEnabled || modifierPan));

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <div
        ref={containerRef}
        className={`scrollbar-none h-full w-full overflow-auto ${
          canPan
            ? isPanning
              ? "cursor-grabbing select-none"
              : "cursor-grab"
            : ""
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={() => endPan()}
      >
        {showEmpty ? (
          <div className="flex min-h-full min-w-full items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                No PDF loaded
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Upload a multipage construction drawing to begin.
              </p>
            </div>
          </div>
        ) : null}

        {isLoading && !pdf ? (
          <div className="flex min-h-full min-w-full items-center justify-center text-sm text-zinc-500">
            Loading PDF…
          </div>
        ) : null}

        {statusMessage ? (
          <div className="flex min-h-full min-w-full items-center justify-center px-6">
            <div className="max-w-md text-center text-sm text-red-600 dark:text-red-400">
              {statusMessage}
            </div>
          </div>
        ) : null}

        {/*
          Center when the page fits; when zoomed larger than the viewport,
          keep ALL edges reachable. Flex justify-center alone clips the
          leading overflow so you can't pan to the top/left.
        */}
        <div
          className={`flex w-max min-h-full min-w-full ${
            pdf && !statusMessage ? "" : "pointer-events-none invisible absolute"
          }`}
        >
          <div className="relative m-auto p-8 shadow-sm">
            <canvas ref={canvasRef} className="block bg-white" />
            {overlay}
          </div>
        </div>
      </div>

      {(isLoading || isRendering) && pdf ? (
        <div className="pointer-events-none absolute right-4 top-4 z-20 rounded bg-black/60 px-2 py-1 text-xs text-white">
          Rendering…
        </div>
      ) : null}

      {chrome}
    </div>
  );
}
