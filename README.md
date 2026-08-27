# MaxConstuctionOCR

Client-side PDF annotation + local OCR viewer for construction drawings.

Design notes live in the vault: `Alexandria/Provision/Design Decisions.md`.

## Structure

```
src/
├── app/                  # Next.js App Router entry
├── components/
│   ├── layout/           # AppShell, Toolbar
│   ├── pdf/              # PdfUploader, PdfViewer, PageNavigator
│   ├── annotations/      # AnnotationOverlay, AnnotationToolbar
│   └── ocr/              # OcrInspector
├── hooks/                # useDocument, useAnnotations
└── lib/
    ├── types/            # Domain models
    ├── storage/          # IndexedDB stubs
    ├── pdf/              # PDF.js stubs
    └── ocr/              # Tesseract stubs
```

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
