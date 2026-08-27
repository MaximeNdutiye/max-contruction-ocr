"use client";

import {
  Hand,
  Redo2,
  ScanSearch,
  ShieldBan,
  Trash2,
  Undo2,
} from "lucide-react";

import type { InteractionMode } from "@/hooks/useAnnotations";

type AnnotationToolbarProps = {
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  selectedId?: string | null;
  onDeleteSelected?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  disabled?: boolean;
};

const tools: {
  id: InteractionMode;
  label: string;
  shortcut: string;
  icon: typeof Hand;
  activeClass: string;
}[] = [
  {
    id: "pan",
    label: "Pan",
    shortcut: "V",
    icon: Hand,
    activeClass: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  },
  {
    id: "capture",
    label: "Capture text",
    shortcut: "C",
    icon: ScanSearch,
    activeClass: "bg-emerald-600 text-white",
  },
  {
    id: "ignore",
    label: "Ignore region",
    shortcut: "I",
    icon: ShieldBan,
    activeClass: "bg-red-600 text-white",
  },
];

const modeHints: Record<InteractionMode, string> = {
  pan: "Drag to move · click a box to select",
  capture: "Drag to capture · hold ⌃/⌘ to pan",
  ignore: "Drag to ignore · hold ⌃/⌘ to pan",
};

export function AnnotationToolbar({
  mode,
  onModeChange,
  selectedId = null,
  onDeleteSelected,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  disabled = false,
}: AnnotationToolbarProps) {
  return (
    <div
      className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className={`rounded-full bg-zinc-900/75 px-3 py-1 text-[11px] text-zinc-100 backdrop-blur-sm transition-opacity ${
          disabled ? "opacity-0" : "opacity-100"
        }`}
      >
        {modeHints[mode]}
      </div>

      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-zinc-200/80 bg-white/95 p-1.5 shadow-lg shadow-zinc-900/10 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95 dark:shadow-black/40">
        <button
          type="button"
          disabled={disabled || !canUndo}
          onClick={onUndo}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Undo (⌘Z)"
          title="Undo (⌘Z)"
        >
          <Undo2 className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          disabled={disabled || !canRedo}
          onClick={onRedo}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Redo (⇧⌘Z)"
          title="Redo (⇧⌘Z)"
        >
          <Redo2 className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

        {tools.map((tool) => {
          const Icon = tool.icon;
          const active = mode === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              disabled={disabled}
              onClick={() => onModeChange(tool.id)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? tool.activeClass
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
              aria-pressed={active}
              aria-label={`${tool.label} (${tool.shortcut})`}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </button>
          );
        })}

        <div className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

        <button
          type="button"
          disabled={disabled || !selectedId}
          onClick={onDeleteSelected}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          aria-label="Delete selected annotation (Delete)"
          title="Delete selected (Delete)"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
