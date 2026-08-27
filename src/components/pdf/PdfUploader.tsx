"use client";

type PdfUploaderProps = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  fileName?: string | null;
};

export function PdfUploader({
  onFileSelected,
  disabled = false,
  fileName,
}: PdfUploaderProps) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded border border-dashed px-3 py-1.5 text-xs transition-colors ${
        disabled
          ? "cursor-not-allowed border-zinc-200 text-zinc-400 dark:border-zinc-700"
          : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
      }`}
    >
      <span className="font-medium">{fileName ? "Replace PDF" : "Upload PDF"}</span>
      {fileName ? (
        <span className="max-w-40 truncate text-zinc-400" title={fileName}>
          {fileName}
        </span>
      ) : null}
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}
