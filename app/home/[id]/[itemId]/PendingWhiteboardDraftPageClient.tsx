"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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

export default function PendingWhiteboardDraftPageClient({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
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
    // Keep the live draft mounted until Convex has delivered the new record.
    // The permanent page reads the warmed cache, so there is no skeleton flash.
    if (!draft?.whiteboardId || syncedWhiteboard === undefined) return;
    router.replace(
      `/home/${draft.workingSpaceId}/${buildItemSlug(draft.title, draft.whiteboardId)}`,
    );
  }, [draft, router, syncedWhiteboard]);

  if (!draft && !isHydrated) return null;
  if (!draft)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        This whiteboard draft is no longer available.
      </div>
    );

  const handleChange = async (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    const { serializeAsJSON } = await import("@excalidraw/excalidraw");
    updateDraft(token, serializeAsJSON(elements, appState, files, "local"));
  };

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
