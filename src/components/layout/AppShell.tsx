type AppShellProps = {
  toolbar: React.ReactNode;
  pages?: React.ReactNode;
  viewer: React.ReactNode;
  inspector: React.ReactNode;
  pagesOpen?: boolean;
  inspectorOpen?: boolean;
  onTogglePages?: () => void;
  onToggleInspector?: () => void;
};

function PanelToggle({
  label,
  expanded,
  side,
  onClick,
}: {
  label: string;
  expanded: boolean;
  side: "left" | "right";
  onClick: () => void;
}) {
  const chevron =
    side === "left"
      ? expanded
        ? "‹"
        : "›"
      : expanded
        ? "›"
        : "‹";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      title={expanded ? `Collapse ${label}` : `Expand ${label}`}
    >
      <span className="text-lg leading-none" aria-hidden>
        {chevron}
      </span>
    </button>
  );
}

export function AppShell({
  toolbar,
  pages,
  viewer,
  inspector,
  pagesOpen = true,
  inspectorOpen = true,
  onTogglePages,
  onToggleInspector,
}: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        {toolbar}
      </header>
      <div className="flex min-h-0 flex-1">
        {pages ? (
          pagesOpen ? (
            <aside className="flex w-44 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-200 px-2 dark:border-zinc-800">
                <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  Pages
                </span>
                {onTogglePages ? (
                  <PanelToggle
                    label="pages"
                    expanded
                    side="left"
                    onClick={onTogglePages}
                  />
                ) : null}
              </div>
              <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
                {pages}
              </div>
            </aside>
          ) : (
            <aside className="flex w-10 shrink-0 flex-col items-center border-r border-zinc-200 bg-zinc-50 pt-2 dark:border-zinc-800 dark:bg-zinc-950">
              {onTogglePages ? (
                <PanelToggle
                  label="pages"
                  expanded={false}
                  side="left"
                  onClick={onTogglePages}
                />
              ) : null}
              <span
                className="mt-3 text-[10px] font-medium uppercase tracking-wide text-zinc-400"
                style={{ writingMode: "vertical-rl" }}
              >
                Pages
              </span>
            </aside>
          )
        ) : null}

        <main className="min-w-0 flex-1 overflow-hidden">{viewer}</main>

        {inspectorOpen ? (
          <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 dark:border-zinc-800">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-200 px-2 dark:border-zinc-800">
              {onToggleInspector ? (
                <PanelToggle
                  label="OCR inspector"
                  expanded
                  side="right"
                  onClick={onToggleInspector}
                />
              ) : (
                <span />
              )}
              <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                OCR
              </span>
            </div>
            <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
              {inspector}
            </div>
          </aside>
        ) : (
          <aside className="flex w-10 shrink-0 flex-col items-center border-l border-zinc-200 pt-2 dark:border-zinc-800">
            {onToggleInspector ? (
              <PanelToggle
                label="OCR inspector"
                expanded={false}
                side="right"
                onClick={onToggleInspector}
              />
            ) : null}
            <span
              className="mt-3 text-[10px] font-medium uppercase tracking-wide text-zinc-400"
              style={{ writingMode: "vertical-rl" }}
            >
              OCR
            </span>
          </aside>
        )}
      </div>
    </div>
  );
}
