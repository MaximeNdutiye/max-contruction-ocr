"use client";

import { useEffect, useRef } from "react";

import {
  isRenderCancelled,
  renderPage,
  type LoadedPdf,
} from "@/lib/pdf/pdfRenderer";

const THUMB_WIDTH = 120;

type PageThumbnailProps = {
  pdf: LoadedPdf;
  pageNumber: number;
  isActive: boolean;
  onSelect: (pageNumber: number) => void;
};

function PageThumbnail({
  pdf,
  pageNumber,
  isActive,
  onSelect,
}: PageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handle = renderPage(pdf, pageNumber, canvas, THUMB_WIDTH);

    void handle.promise.catch((err) => {
      if (!isRenderCancelled(err)) console.error(err);
    });

    return () => {
      handle.cancel();
    };
  }, [pdf, pageNumber]);

  useEffect(() => {
    if (isActive) {
      buttonRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => onSelect(pageNumber)}
      className={`w-full rounded-md p-2 text-left transition-colors ${
        isActive
          ? "bg-zinc-200 ring-2 ring-zinc-900 dark:bg-zinc-800 dark:ring-zinc-100"
          : "hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70"
      }`}
      aria-current={isActive ? "page" : undefined}
      aria-label={`Page ${pageNumber}`}
    >
      <div className="overflow-hidden rounded border border-zinc-300 bg-white shadow-sm dark:border-zinc-600">
        <canvas ref={canvasRef} className="block w-full" />
      </div>
      <span className="mt-1.5 block text-center text-[11px] tabular-nums text-zinc-500">
        {pageNumber}
      </span>
    </button>
  );
}

type PageThumbnailsProps = {
  pdf: LoadedPdf | null;
  pageCount: number;
  currentPage: number;
  onSelectPage: (page: number) => void;
};

export function PageThumbnails({
  pdf,
  pageCount,
  currentPage,
  onSelectPage,
}: PageThumbnailsProps) {
  if (!pdf || pageCount < 1) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-zinc-400">
        Pages appear here after upload
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {Array.from({ length: pageCount }, (_, index) => {
        const pageNumber = index + 1;
        return (
          <PageThumbnail
            key={`${pdf.fingerprints?.[0] ?? "pdf"}-${pageNumber}`}
            pdf={pdf}
            pageNumber={pageNumber}
            isActive={pageNumber === currentPage}
            onSelect={onSelectPage}
          />
        );
      })}
    </div>
  );
}
