type ToolbarProps = {
  children?: React.ReactNode;
};

export function Toolbar({ children }: ToolbarProps) {
  return (
    <div className="flex h-14 items-center gap-4 px-4">
      <span className="text-sm font-semibold tracking-tight">MaxConstuctionOCR</span>
      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      {children}
    </div>
  );
}
