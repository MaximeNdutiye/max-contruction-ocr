/**
 * IndexedDB persistence for PDF blobs, metadata, and annotations.
 */

import { createStore, get, keys, set } from "idb-keyval";

import type { Annotation, DocumentMetadata } from "@/lib/types";

const store = createStore("max-constuction-ocr-db", "keyval");

const ACTIVE_DOC_KEY = "mco_active_doc_id";
const META_KEY_PREFIX = "mco_doc_meta:";

function metaKey(id: string) {
  return `${META_KEY_PREFIX}${id}`;
}

function pdfKey(id: string) {
  return `mco_pdf_file:${id}`;
}

function annotationsKey(id: string) {
  return `mco_annotations:${id}`;
}

export async function getActiveDocumentId(): Promise<string | null> {
  const value = await get<string>(ACTIVE_DOC_KEY, store);
  return value ?? null;
}

export async function setActiveDocumentId(id: string): Promise<void> {
  await set(ACTIVE_DOC_KEY, id, store);
}

export async function getDocumentMetadata(
  id: string,
): Promise<DocumentMetadata | null> {
  const value = await get<DocumentMetadata>(metaKey(id), store);
  return value ?? null;
}

export async function saveDocumentMetadata(
  meta: DocumentMetadata,
): Promise<void> {
  await set(metaKey(meta.id), meta, store);
}

/**
 * Find a previously saved document with the same file name + size.
 * If several match, return the most recently updated.
 */
export async function findDocumentByFile(
  name: string,
  fileSize: number,
): Promise<DocumentMetadata | null> {
  const allKeys = await keys(store);
  let best: DocumentMetadata | null = null;

  for (const key of allKeys) {
    if (typeof key !== "string" || !key.startsWith(META_KEY_PREFIX)) continue;
    const meta = await get<DocumentMetadata>(key, store);
    if (!meta || meta.name !== name || meta.fileSize !== fileSize) continue;
    if (!best || meta.updatedAt > best.updatedAt) best = meta;
  }

  return best;
}

export async function getPdfFile(id: string): Promise<Blob | null> {
  const value = await get<Blob>(pdfKey(id), store);
  return value ?? null;
}

export async function savePdfFile(id: string, file: Blob): Promise<void> {
  await set(pdfKey(id), file, store);
}

export async function getAnnotations(documentId: string): Promise<Annotation[]> {
  const value = await get<Annotation[]>(annotationsKey(documentId), store);
  return value ?? [];
}

export async function saveAnnotations(
  documentId: string,
  annotations: Annotation[],
): Promise<void> {
  await set(annotationsKey(documentId), annotations, store);
}

/** Best-effort: ask the browser not to evict this origin's storage. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
