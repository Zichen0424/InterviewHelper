"use client";
import { useMemo, useSyncExternalStore } from "react";

export const HEARTS_KEY = "interview-notes:hearts:v1";
const EVENT = "interview-notes:hearts-changed";
let temporary: string | undefined;

export function parseHearts(raw: string | null): Set<string> {
  try {
    const values: unknown = JSON.parse(raw || "[]");
    return new Set(Array.isArray(values) ? values.filter((v): v is string => typeof v === "string" && v.length > 0) : []);
  } catch { return new Set(); }
}
function snapshot(): string {
  if (temporary !== undefined) return temporary;
  try { return window.localStorage.getItem(HEARTS_KEY) || "[]"; } catch { return "[]"; }
}
function subscribe(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === HEARTS_KEY || event.key === null) { temporary = undefined; callback(); }
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", onStorage); };
}
export function toggleHeart(id: string): boolean {
  const liked = parseHearts(snapshot());
  if (liked.has(id)) liked.delete(id); else liked.add(id);
  const next = JSON.stringify([...liked].sort());
  let saved = true;
  try { window.localStorage.setItem(HEARTS_KEY, next); temporary = undefined; }
  catch { temporary = next; saved = false; }
  window.dispatchEvent(new Event(EVENT));
  return saved;
}
export function useHearts(): Set<string> {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  return useMemo(() => parseHearts(raw), [raw]);
}
