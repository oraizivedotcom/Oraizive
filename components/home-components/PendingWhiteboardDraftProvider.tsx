"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

type DraftPhase = "creating" | "ready" | "error";
const STORAGE_KEY = "oraizive_pending_whiteboard_drafts";

export interface PendingWhiteboardDraft {
  token: string;
  workingSpaceId: Id<"folders">;
  tableId: Id<"tables">;
  title: string;
  snapshot?: string;
  revision: number;
  whiteboardId?: Id<"whiteboards">;
  phase: DraftPhase;
  error?: string;
}

interface PendingWhiteboardDraftContextValue {
  isHydrated: boolean;
  beginWhiteboardDraft: (args: {
    workingSpaceId: Id<"folders">;
    tableId: Id<"tables">;
    title?: string;
  }) => { token: string; completion: Promise<Id<"whiteboards">> };
  getDraft: (token: string) => PendingWhiteboardDraft | undefined;
  updateDraft: (token: string, snapshot: string) => void;
  retryDraft: (token: string) => void;
}

const PendingWhiteboardDraftContext =
  createContext<PendingWhiteboardDraftContextValue | null>(null);

export function PendingWhiteboardDraftProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [drafts, setDrafts] = useState<Record<string, PendingWhiteboardDraft>>(
    {},
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const draftsRef = useRef(drafts);
  const jobsRef = useRef(new Map<string, Promise<Id<"whiteboards">>>());
  const createWhiteboard = useMutation(api.whiteboards.createWhiteboard);
  const updateWhiteboard = useMutation(api.whiteboards.updateWhiteboard);

  const storeDraft = useCallback(
    (token: string, draft: PendingWhiteboardDraft | undefined) => {
      const next = { ...draftsRef.current };
      if (draft) next[token] = draft;
      else delete next[token];
      draftsRef.current = next;
      setDrafts(next);
    },
    [],
  );

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<
          string,
          PendingWhiteboardDraft
        >;
        const next = { ...parsed, ...draftsRef.current };
        draftsRef.current = next;
        setDrafts(next);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (Object.keys(drafts).length)
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory draft still lets the current whiteboard open immediately.
    }
  }, [drafts, isHydrated]);

  const persistDraft = useCallback(
    (token: string): Promise<Id<"whiteboards">> => {
      const existing = jobsRef.current.get(token);
      if (existing) return existing;

      const job = (async () => {
        const draft = draftsRef.current[token];
        if (!draft) throw new Error("Whiteboard draft is no longer available");
        try {
          const whiteboardId = await createWhiteboard({
            title: draft.title,
            folderId: draft.workingSpaceId,
            tableId: draft.tableId,
          });
          while (true) {
            const current = draftsRef.current[token];
            if (!current)
              throw new Error("Whiteboard draft is no longer available");
            const revision = current.revision;
            if (current.snapshot) {
              await updateWhiteboard({
                _id: whiteboardId,
                snapshot: current.snapshot,
              });
            }
            const latest = draftsRef.current[token];
            if (latest?.revision === revision) {
              storeDraft(token, {
                ...latest,
                whiteboardId,
                phase: "ready",
                error: undefined,
              });
              break;
            }
          }
          return whiteboardId;
        } catch (error) {
          const current = draftsRef.current[token];
          if (current) {
            storeDraft(token, {
              ...current,
              phase: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Could not create this whiteboard.",
            });
          }
          throw error;
        }
      })();
      jobsRef.current.set(token, job);
      void job
        .finally(() => jobsRef.current.delete(token))
        .catch(() => undefined);
      return job;
    },
    [createWhiteboard, storeDraft, updateWhiteboard],
  );

  const beginWhiteboardDraft = useCallback(
    (args: {
      workingSpaceId: Id<"folders">;
      tableId: Id<"tables">;
      title?: string;
    }) => {
      const token = crypto.randomUUID().replaceAll("-", "");
      storeDraft(token, {
        token,
        ...args,
        title: args.title ?? "Untitled whiteboard",
        revision: 0,
        phase: "creating",
      });
      return { token, completion: persistDraft(token) };
    },
    [persistDraft, storeDraft],
  );

  useEffect(() => {
    if (!isHydrated) return;
    Object.values(drafts).forEach((draft) => {
      if (draft.phase === "creating") {
        void persistDraft(draft.token).catch(() => undefined);
      }
    });
  }, [drafts, isHydrated, persistDraft]);

  const retryDraft = useCallback(
    (token: string) => {
      const draft = draftsRef.current[token];
      if (!draft) return;
      storeDraft(token, { ...draft, phase: "creating", error: undefined });
      void persistDraft(token).catch(() => undefined);
    },
    [persistDraft, storeDraft],
  );

  const updateDraft = useCallback(
    (token: string, snapshot: string) => {
      const draft = draftsRef.current[token];
      if (!draft || draft.snapshot === snapshot) return;
      storeDraft(token, { ...draft, snapshot, revision: draft.revision + 1 });
    },
    [storeDraft],
  );

  return (
    <PendingWhiteboardDraftContext.Provider
      value={{
        isHydrated,
        beginWhiteboardDraft,
        getDraft: (token) => drafts[token],
        updateDraft,
        retryDraft,
      }}
    >
      {children}
    </PendingWhiteboardDraftContext.Provider>
  );
}

export function usePendingWhiteboardDraftContext() {
  const context = useContext(PendingWhiteboardDraftContext);
  if (!context) throw new Error("PendingWhiteboardDraftProvider is missing");
  return context;
}

export function usePendingWhiteboardDraft(token: string) {
  return usePendingWhiteboardDraftContext().getDraft(token);
}
