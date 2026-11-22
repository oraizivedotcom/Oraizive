let canvasModule: Promise<typeof import("@excalidraw/excalidraw")> | undefined;

/** Starts fetching the canvas bundle without blocking the current interaction. */
export function preloadWhiteboardCanvas() {
  canvasModule ??= import("@excalidraw/excalidraw");
  return canvasModule;
}
