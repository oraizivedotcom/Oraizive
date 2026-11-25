import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type PrefetchedWhiteboard = FunctionReturnType<
  typeof api.whiteboards.getWhiteboardById
>;

const CACHE_TTL_MS = 5 * 60_000;
const whiteboards = new Map<
  string,
  { value: PrefetchedWhiteboard; expiresAt: number }
>();

export function getPrefetchedWhiteboard(whiteboardId: string) {
  const entry = whiteboards.get(whiteboardId);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    whiteboards.delete(whiteboardId);
    return undefined;
  }
  return entry.value;
}

export function cachePrefetchedWhiteboard(whiteboard: PrefetchedWhiteboard) {
  if (!whiteboard) return;
  const whiteboardId = String(whiteboard._id);
  whiteboards.set(whiteboardId, {
    value: whiteboard,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
