"use client";

import type { Annotation } from "@/lib/types";

type OcrInspectorProps = {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRerun?: (id: string) => void;
};

function statusLabel(status: Annotation["ocrStatus"]) {
  switch (status) {
    case "processing":
      return "Running OCR…";
    case "completed":
      return "Completed";
    case "error":
      return "Failed";
    default:
      return "Idle";
  }
}

export function OcrInspector({
  annotations,
  selectedId,
  onSelect,
  onRerun,
}: OcrInspectorProps) {
  const captures = annotations.filter((annotation) => annotation.type === "capture");

  if (captures.length === 0) {
    return (
      <div className="flex h-full flex-col p-4">
        <p className="text-xs leading-relaxed text-zinc-500">
          Draw a green <span className="font-medium text-emerald-600">Capture</span>{" "}
          box on the page to extract text with local OCR.
        </p>
        <div className="mt-4 flex-1 rounded border border-dashed border-zinc-300 dark:border-zinc-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
        Capture regions · {captures.length}
      </p>

      <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto scrollbar-none">
        {captures.map((annotation, index) => {
          const selected = annotation.id === selectedId;
          return (
            <li key={annotation.id}>
              <button
                type="button"
                onClick={() => onSelect(annotation.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? "border-emerald-500 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-950/30"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-800 dark:text-zinc-100">
                    Capture {index + 1}
                    <span className="ml-1 font-normal text-zinc-400">
                      · p{annotation.pageNumber}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] ${
                      annotation.ocrStatus === "completed"
                        ? "text-emerald-600"
                        : annotation.ocrStatus === "error"
                          ? "text-red-500"
                          : annotation.ocrStatus === "processing"
                            ? "text-amber-600"
                            : "text-zinc-400"
                    }`}
                  >
                    {statusLabel(annotation.ocrStatus)}
                    {annotation.ocrStatus === "completed" &&
                    typeof annotation.ocrConfidence === "number"
                      ? ` · ${Math.round(annotation.ocrConfidence)}%`
                      : ""}
                  </span>
                </div>

                <div className="mt-2 min-h-16 whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {annotation.ocrStatus === "processing"
                    ? "Extracting text…"
                    : annotation.extractedText?.trim()
                      ? annotation.extractedText.trim()
                      : annotation.ocrStatus === "error"
                        ? "OCR failed for this region."
                        : "No text detected."}
                </div>

                {onRerun && annotation.ocrStatus !== "processing" ? (
                  <span
                    role="link"
                    tabIndex={0}
                    className="mt-2 inline-block text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRerun(annotation.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onRerun(annotation.id);
                      }
                    }}
                  >
                    Re-run OCR
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
