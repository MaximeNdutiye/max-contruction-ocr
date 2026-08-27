"use client";

type ZoomControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  disabled?: boolean;
};

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  disabled = false,
}: ZoomControlsProps) {
  const label = `${Math.round(zoom * 100)}%`;

  return (
    <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
      <button
        type="button"
        onClick={onZoomOut}
        disabled={disabled}
        className="rounded border border-zinc-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className="min-w-14 rounded border border-zinc-200 px-2 py-1 tabular-nums disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
        title="Reset zoom"
        aria-label={`Zoom ${label}. Click to reset.`}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={disabled}
        className="rounded border border-zinc-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
}
