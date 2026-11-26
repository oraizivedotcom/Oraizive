"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import { useMutation } from "convex/react";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import { buildItemSlug } from "@/lib/slug";
import { preloadWhiteboardCanvas } from "@/lib/whiteboard-canvas";
import { cachePrefetchedWhiteboard } from "@/lib/whiteboardPrefetchCache";
import { useQuery } from "@/cache/useQuery";
import { api } from "@/convex/_generated/api";
import {
  usePendingWhiteboardDraft,
  usePendingWhiteboardDraftContext,
} from "@/components/home-components/PendingWhiteboardDraftProvider";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

const Excalidraw = dynamic(
  async () => (await preloadWhiteboardCanvas()).Excalidraw,
  { ssr: false },
);

function getPreview(elements: readonly ExcalidrawElement[]) {
  const shapeCount = elements.filter((element) => !element.isDeleted).length;
  if (shapeCount === 0) return "";
  return shapeCount === 1 ? "1 shape" : `${shapeCount} shapes`;
}

export default function PendingWhiteboardDraftPageClient({
  token,
}: {
  token: string;
}) {
  const { resolvedTheme } = useTheme();
  const draft = usePendingWhiteboardDraft(token);
  const { isHydrated, retryDraft, updateDraft } =
    usePendingWhiteboardDraftContext();
  const syncedWhiteboard = useQuery(
    api.whiteboards.getWhiteboardById,
    draft?.whiteboardId ? { _id: draft.whiteboardId } : "skip",
  );

  useEffect(() => {
    if (syncedWhiteboard) cachePrefetchedWhiteboard(syncedWhiteboard);
  }, [syncedWhiteboard]);

  useEffect(() => {
    if (!draft?.whiteboardId || !syncedWhiteboard) return;
    const currentUrl = new URL(window.location.href);
    const expectedSlug = buildItemSlug(draft.title, draft.whiteboardId);
    if (!currentUrl.pathname.endsWith(`/${expectedSlug}`)) {
      currentUrl.pathname = `/home/${draft.workingSpaceId}/${expectedSlug}`;
      window.history.replaceState({}, "", currentUrl.href);
    }
  }, [draft, syncedWhiteboard]);

  const updateWhiteboard = useMutation(api.whiteboards.updateWhiteboard);
  const saveLiveScene = useDebouncedCallback(
    async (snapshot: string, preview: string) => {
      if (!draft?.whiteboardId) return;
      await updateWhiteboard({
        _id: draft.whiteboardId,
        snapshot,
        preview,
      });
    },
    700,
  );

  useEffect(
    () => () => {
      void saveLiveScene.flush();
    },
    [saveLiveScene],
  );

  const handleChange = useCallback(
    async (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const { serializeAsJSON } = await import("@excalidraw/excalidraw");
      const snapshot = serializeAsJSON(elements, appState, files, "local");
      updateDraft(token, snapshot);
      if (draft?.whiteboardId) {
        void saveLiveScene(snapshot, getPreview(elements));
      }
    },
    [draft?.whiteboardId, saveLiveScene, token, updateDraft],
  );

  if (!draft && !isHydrated) return null;
  if (!draft)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        This whiteboard draft is no longer available.
      </div>
    );

  return (
    <div className="whiteboard-canvas relative h-full min-h-[calc(100vh-5rem)] min-w-full overflow-hidden bg-background">
      <Excalidraw
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
            toggleTheme: false,
          },
        }}
        onChange={(elements, appState, files) =>
          void handleChange(elements, appState, files)
        }
        theme={resolvedTheme === "dark" ? "dark" : "light"}
      />
      {draft.phase === "error" && (
        <div className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 border border-destructive bg-background px-3 py-2 text-sm text-destructive">
          <span>{draft.error || "Couldn’t create this whiteboard."}</span>
          <Button size="sm" variant="outline" onClick={() => retryDraft(token)}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
