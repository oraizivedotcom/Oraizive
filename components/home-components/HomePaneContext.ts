"use client";

import { createContext, useContext } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export type HomePaneItem =
  | {
      type: "note";
      id: Id<"documents">;
      title?: string;
      slug?: string;
      workingSpaceId?: Id<"folders">;
    }
  | {
      type: "pdf";
      id: Id<"pdfs">;
      title?: string;
      workingSpaceId?: Id<"folders">;
    }
  | {
      type: "workspace";
      id: Id<"folders">;
      title?: string;
    };

type HomePaneContextValue = {
  activeItem: HomePaneItem | null;
  openPane: (item: HomePaneItem) => void;
  closePane: () => void;
};

export const HomePaneContext = createContext<HomePaneContextValue | null>(null);

export function useHomePane() {
  const context = useContext(HomePaneContext);
  if (!context) {
    throw new Error("useHomePane must be used within HomePaneProvider.");
  }
  return context;
}
