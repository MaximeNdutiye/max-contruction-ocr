# MaxConstuctionOCR

Client-side PDF annotation + local OCR viewer for construction drawings (Provision take-home screen).

**Live demo:** [https://max-contruction-ocr.vercel.app/](https://max-contruction-ocr.vercel.app/)

---

## Run locally

**Requirements:** Node.js 20+ (recommended) and npm.

```bash
# From the repo root
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Upload a multipage construction PDF (sample files may live under `example files/`). Use **C** / **I** / **V** for capture, ignore, and pan. Annotations and the PDF persist in the browser via IndexedDB (same origin / same machine).

Other scripts:

```bash
npm run build   # production build
npm run start   # serve the production build (after build)
npm run lint    # ESLint
```

---

## Project structure

```
src/
├── app/                  # Next.js App Router entry
├── components/
│   ├── layout/           # AppShell, Toolbar
│   ├── pdf/              # PdfUploader, PdfViewer, thumbnails, zoom
│   ├── annotations/      # Overlay + tool rail
│   ├── ocr/              # OCR inspector
│   └── workspace/        # Wires document, annotations, OCR
├── hooks/                # useDocument, useAnnotations
└── lib/
    ├── types/
    ├── storage/          # IndexedDB
    ├── pdf/              # PDF.js helpers
    └── ocr/              # Crop + Tesseract
```

---

# Design Decisions

**Context:** Take-home screen for [Provision — Full Stack Software Engineer](https://provision.com/careers/full-stack-software-engineer) (document viewer + annotation + local OCR on construction PDFs).

**Intent of this doc:** Show how I turn an ambiguous construction workflow into useful software — with clear tradeoffs, quantified constraints, and a path from prototype to production document-processing systems.

---

## 1. Product framing (why this exists)

Provision automates construction work so contractors can move faster with less risk. Preconstruction teams live in drawings: they need to **see the sheet**, **point at regions that matter**, and **trust extracted text enough to act** — the same class of problem as document-processing and AI-assisted review workflows.

This take-home is a **focused prototype** of that surface:

| Requirement             | Customer-facing value                                             |
| :---------------------- | :---------------------------------------------------------------- |
| Multipage PDF viewer    | Review real sheets without leaving the browser                    |
| Green **capture** boxes | Mark the source region (traceability to the drawing)              |
| Red **ignore** boxes    | Explicitly exclude stamps / noise from extraction                 |
| Local persistence       | Resume review after refresh without re-upload friction            |
| Local OCR (bonus)       | Prove an on-device extraction path and **measure where it fails** |

The goal is not “best possible OCR.” It is a **usable product surface** that makes technical constraints for construction-document AI **visible and honest**.

---

## 2. How this maps to the role

Aligned with what the [FSSE role](https://provision.com/careers/full-stack-software-engineer) emphasizes:

| Role signal | How this project demonstrates it |
| :--- | :--- |
| **Product surfaces + document processing** | React viewer, annotation UX, PDF rasterization, region crop → OCR |
| **Prototypes that prove concepts & quantify constraints** | Iterated OCR approaches on real floor plans; recorded what broke and why |
| **AI into customer workflows (with judgment)** | Local OCR is the AI feature; we did not hide failures behind a PDF text-layer “cheat” |
| **Reliability / performance / quality** | Singleton OCR worker, cancel stale PDF renders, IndexedDB for large binaries, fit-width + pan under load |
| **Security & maintainability** | Drawings stay on-device; OCR pipeline kept naive and reviewable |
| **User value over cleverness** | Capture/ignore + inspector over opaque multi-pass image morphologies |

**Stack note:** Production Provision leans React + Python/Django. This screen is intentionally **React-first / client-heavy** (Vercel-friendly, no secrets, matches local-OCR bonus). Section 9 sketches how the same contracts would sit behind a Django/document service if this moved toward a real pipeline.

---

## 3. Architecture (as shipped)

**Client-side, serverless-friendly.** Construction PDFs are confidential, large, and vector-dense. Browser rendering + WASM OCR keeps data private, avoids server timeouts, and ships as a static Next.js app.

```
Upload PDF → IndexedDB (blob + meta + annotations)
     ↓
PDF.js (legacy) → viewport canvas + page thumbs
     ↓
SVG overlay (capture / ignore, normalized 0–1 boxes)
     ↓
High-DPI PDF region re-render → white-out ignore ∩ crop
     ↓
Tesseract.js (singleton worker, char whitelist)
     ↓
OCR Inspector (status, confidence, extracted text)
```

**UI shell:** collapsible thumbs | sheet viewer + floating tool rail | collapsible OCR inspector.

---

## 4. Decisions & tradeoffs

### D1 — Local WASM OCR (not cloud, not serverless binaries)
* **Chose:** `tesseract.js` in a Web Worker.
* **Why:** Matches the local-OCR bonus; zero API keys; no Vercel OCR timeout story; privacy by default for bid drawings.
* **Cost:** Language data download; CPU on the user’s machine; accuracy below cloud vision / purpose-built drawing models.
* **Rejected:** Cloud Vision/Textract (contra local requirement; keys; cost). Node Tesseract on Vercel (cold start, binary size, short executions on ARCH sheets).

### D2 — Normalized coordinates (0–1)
* Screen pixels break under zoom, fit-width, and DPR.
* One coordinate system for overlay, persistence, and OCR crops keeps annotations stable across resize — a small design choice that protects **reliability** of the review surface.

### D3 — SVG annotation layer (not canvas framework)
* Declarative React, crisp at zoom, cheap hit-testing for rectangles.
* Modes: pan / capture / ignore (`V` / `C` / `I`), undo/redo, delete; ⌃/⌘-drag pan so drawing stays primary.
* **Rejected:** Konva/Fabric — bundle and API surface for two rectangle tools.

### D4 — Naive OCR pipeline (after measuring harder ones)
Construction sheets fight generic OCR (thin fonts + dense linework). We **prototyped heavier approaches**, then simplified — engineering judgment over sunk-cost complexity.

| Approach | What we learned | Verdict |
| :--- | :--- | :--- |
| Screen crop + hard threshold | Fit-width softens glyphs; thresholding crushed thin lettering | Rejected |
| Line removal + multi-PSM + junk filters | Helped some large crops; **missed tight labels** (e.g. “KITCHEN”); hard to debug | Rejected |
| PDF `getTextContent()` in the box | Best accuracy when vector text exists | Tried, then **reverted** — hid the OCR path |
| High-DPI PDF crop → ignore mask → **one** Tesseract + whitelist | Reviewable; constraints remain visible | **Selected** |

**Shipped path:** re-render capture at high DPI → paint overlapping ignore regions white → single `PSM.SINGLE_BLOCK` recognize with a drawing-oriented **character whitelist** → trim → inspector.

**Why keep only the whitelist:** Cheap prior against border-as-`|`/`=` hallucinations without pretending we solved blueprint OCR. **Taste and maintainability > opaque “AI magic.”**

### D5 — Crop from PDF re-render, not the on-screen canvas
* UI canvas is for reading (fit-width / zoom). Cropping it under-samples glyphs.
* Independent high-DPI render (~3×+) for OCR; **few pixels of padding**, not % of page (percent padding pulled neighboring room tags into small boxes).

### D6 — Pure OCR as the extraction story
* Embedded PDF text would often win on vector sheets.
* For this screen, always-OCR keeps the bonus real and forces us to **quantify** where generic OCR fails on drawings — useful input for a production AI pipeline discussion with ML partners.

### D7 — PDF.js **legacy** build
* Modern build assumed newer builtins some browsers lack → blank sheets for reviewers.
* Dynamic import + worker in `/public` — compatibility and security of “it works on the reviewer’s laptop” over bleeding-edge.

### D8 — IndexedDB (not `localStorage`) for documents
* Multi‑MB PDFs exceed `localStorage`; sync Base64 freezes the UI.
* Dedicated DB `max-constuction-ocr-db` / `mco_*` keys; auto-save; restore active doc, page, annotations.
* Best-effort `navigator.storage.persist()` — quality of persistence for confidential files.

### D9 — Viewer UX: fit-width zoom + pan
* Sheet-on-a-board feel; hidden scrollbars; pan reaches all edges when zoomed.
* Tradeoff: slightly less discoverable than native scroll; better for annotation gestures on large sheets.

---

## 5. Persistence (document store)

| | `localStorage` | IndexedDB (`idb-keyval`) |
| :--- | :--- | :--- |
| Quota | ~5 MB | Large (quota-dependent) |
| Types | Strings | `Blob` / structured clone |
| Thread | Sync (blocks UI) | Async |
| Role here | Unused for docs | PDF + annotations |

```
mco_active_doc_id
mco_doc_meta:{id}      → DocumentMetadata
mco_pdf_file:{id}      → Blob
mco_annotations:{id}   → Annotation[]
```

Lifecycle: upload → persist blob/meta → annotate/OCR → auto-save → reload restores sheet + boxes + inspector.

---

## 6. Data model

```typescript
type AnnotationType = 'capture' | 'ignore';
type OCRStatus = 'idle' | 'processing' | 'completed' | 'error';

interface BoundingBox {
  x: number; y: number; width: number; height: number; // normalized 0–1
}

interface Annotation extends BoundingBox {
  id: string;
  documentId: string;
  pageNumber: number;
  type: AnnotationType;
  extractedText?: string;
  ocrStatus: OCRStatus;
  ocrConfidence?: number;
  createdAt: number;
}

interface DocumentMetadata {
  id: string;
  name: string;
  pageCount: number;
  fileSize: number;
  lastOpenedPage: number;
  updatedAt: number;
}
```

Capture boxes are intentional **source anchors** (region → text). That mirrors production needs for answers that stay tied to drawings, not free-floating summaries.

---

## 7. Stack (prototype)

| Area | Choice | Why |
| :--- | :--- | :--- |
| App | Next.js 16, React 19 | Product surface; Vercel deploy |
| UI | Tailwind 4, Lucide | Fast shell / tools / inspector |
| PDF | `pdfjs-dist` legacy | Fidelity + browser reach |
| OCR | `tesseract.js` singleton | Local WASM; whitelist only |
| Storage | IndexedDB | Multi-MB docs, no backend |
| Hosting | Vercel | No OCR servers to operate |

---

## 8. Reliability edges

1. **ARCH-size pages** — fit-width + pan; OCR uses separate high-DPI crop.
2. **Accidental clicks** — minimum box size before commit.
3. **Concurrency** — singleton Tesseract; per-annotation job guard; cancel stale PDF.js renders.
4. **Ignore ∩ capture** — whitened before recognize.
5. **Storage eviction** — dedicated DB name; optional persistent storage grant.
6. **OCR on linework** — known limitation; ignore boxes + clear captures; no claim of cloud-grade drawing OCR.

---

## 9. What this prototype proves (and what it does not)

**Proves**
* A React document surface can support multipage review, region annotation, and local extraction.
* Generic raster OCR on construction drawings has **hard constraints** (linework, tight labels, neighbor bleed from loose padding).
* Simpler, auditable pipelines are preferable until evaluation shows a clear win — judgment over complexity.
* On-device processing is a viable privacy posture for sensitive bid documents in a prototype.

**Does not prove**
* Production-grade scope / RFI accuracy or trade-aware understanding.
* Multi-tenant backend auth, collaborative sync, or Django document services (out of screen scope).
* That Tesseract is the right long-term engine for Provision’s drawing AI (it is a stand-in to exercise the product loop).

**If this moved toward a production document-AI pipeline**
* Keep the **viewer + normalized regions + capture/ignore** as the human-in-the-loop / labeling surface.
* Swap the recognizer for a server-side or ML-owned pipeline (Python services, evaluation harness, confidence thresholds, citation back to box + page).
* Persist documents and annotations in a proper backend (e.g. Django + object storage) with access control — IndexedDB becomes offline cache, not system of record.
* Add automated tests around coordinate transforms, crop bounds, and OCR job lifecycle; CI for render regressions.

That split — **prove the product loop and quantify OCR limits in a prototype, then harden the pipeline with ML and backend** — is how I would collaborate on Provision-scale document automation without outsourcing taste, validation, or security to the first model that “looks smart.”

---

## 10. Explicit non-goals (this take-home)

* Cloud / server OCR as the primary path.
* Preferring PDF text layer over OCR for the demo story.
* Opaque multi-pass image morphologies (explored; dropped).
* Multi-document library, auth, or realtime collab.
