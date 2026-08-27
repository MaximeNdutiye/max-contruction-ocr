"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { InteractionMode } from "@/hooks/useAnnotations";
import type { Annotation, AnnotationType, BoundingBox } from "@/lib/types";

type DraftBox = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type AnnotationOverlayProps = {
  annotations: Annotation[];
  mode: InteractionMode;
  selectedId: string | null;
  documentId: string | null;
  pageNumber: number;
  onSelect: (id: string | null) => void;
  onCreate: (
    documentId: string,
    pageNumber: number,
    type: AnnotationType,
    box: BoundingBox,
  ) => void;
  onDelete: (id: string) => void;
};

function draftToBox(draft: DraftBox): BoundingBox {
  const x = Math.min(draft.startX, draft.currentX);
  const y = Math.min(draft.startY, draft.currentY);
  return {
    x,
    y,
    width: Math.abs(draft.currentX - draft.startX),
    height: Math.abs(draft.currentY - draft.startY),
  };
}

function styleForType(type: AnnotationType, selected: boolean) {
  if (type === "capture") {
    return {
      fill: selected ? "rgba(16, 185, 129, 0.28)" : "rgba(16, 185, 129, 0.16)",
      stroke: "#059669",
    };
  }
  return {
    fill: selected ? "rgba(239, 68, 68, 0.28)" : "rgba(239, 68, 68, 0.16)",
    stroke: "#dc2626",
  };
}

export function AnnotationOverlay({
  annotations = [],
  mode,
  selectedId,
  documentId,
  pageNumber,
  onSelect,
  onCreate,
  onDelete,
}: AnnotationOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<DraftBox | null>(null);
  const draftRef = useRef<DraftBox | null>(null);
  const drawingRef = useRef(false);

  const isDrawingMode = mode === "capture" || mode === "ignore";
  const [modifierPan, setModifierPan] = useState(false);

  const updateDraft = useCallback((next: DraftBox | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  useEffect(() => {
    const syncModifier = (event: KeyboardEvent) => {
      const held = event.ctrlKey || event.metaKey;
      setModifierPan(held);
      if (held) {
        drawingRef.current = false;
        updateDraft(null);
      }
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
  }, [updateDraft]);

  const toNormalizedPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onSelect(null);
        updateDraft(null);
        drawingRef.current = false;
        return;
      }

      if (!selectedId) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      onDelete(selectedId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, onDelete, onSelect, updateDraft]);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingMode || !documentId || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey) return;
    if ((event.target as Element).closest("[data-annotation-id]")) return;

    const point = toNormalizedPoint(event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.stopPropagation();
    drawingRef.current = true;
    onSelect(null);
    updateDraft({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    const point = toNormalizedPoint(event.clientX, event.clientY);
    if (!point || !draftRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    updateDraft({
      ...draftRef.current,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const finishDraft = (
    event: React.PointerEvent<SVGSVGElement>,
    commit: boolean,
  ) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    drawingRef.current = false;
    const currentDraft = draftRef.current;
    updateDraft(null);

    if (!commit || !currentDraft || !documentId || !isDrawingMode) return;

    onCreate(documentId, pageNumber, mode, draftToBox(currentDraft));
  };

  const draftBox = draft ? draftToBox(draft) : null;
  const draftStyle = styleForType(mode === "ignore" ? "ignore" : "capture", true);
  const drawingActive = isDrawingMode && !modifierPan;

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 h-full w-full ${
        drawingActive ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finishDraft(event, true)}
      onPointerCancel={(event) => finishDraft(event, false)}
    >
      {(annotations ?? []).map((annotation) => {
        const selected = annotation.id === selectedId;
        const style = styleForType(annotation.type, selected);
        return (
          <rect
            key={annotation.id}
            data-annotation-id={annotation.id}
            x={`${annotation.x * 100}%`}
            y={`${annotation.y * 100}%`}
            width={`${annotation.width * 100}%`}
            height={`${annotation.height * 100}%`}
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={selected ? 2.5 : 1.5}
            vectorEffect="non-scaling-stroke"
            className={
              modifierPan
                ? "pointer-events-none"
                : "pointer-events-auto cursor-pointer"
            }
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(annotation.id);
            }}
          />
        );
      })}

      {draftBox ? (
        <rect
          x={`${draftBox.x * 100}%`}
          y={`${draftBox.y * 100}%`}
          width={`${draftBox.width * 100}%`}
          height={`${draftBox.height * 100}%`}
          fill={draftStyle.fill}
          stroke={draftStyle.stroke}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ) : null}
    </svg>
  );
}
