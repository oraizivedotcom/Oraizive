import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageNavigator } from "./PdfViewerPageClient";
import { usePdf, usePdfJump } from "@anaralabs/lector";
import type { PDFDocumentProxy } from "pdfjs-dist";

vi.mock("@anaralabs/lector", () => ({
  usePdf: vi.fn(),
  usePdfJump: vi.fn(),
}));

const mockUsePdf = vi.mocked(usePdf);
const mockUsePdfJump = vi.mocked(usePdfJump);

describe("PageNavigator", () => {
  beforeEach(() => {
    mockUsePdf.mockImplementation((selector) =>
      selector({
        pdfDocumentProxy: { numPages: 12 } as PDFDocumentProxy,
        currentPage: 3,
      } as Parameters<Parameters<typeof usePdf>[0]>[0]),
    );
    mockUsePdfJump.mockReturnValue({
      jumpToPage: vi.fn(),
      jumpToOffset: vi.fn(),
      jumpToHighlightRects: vi.fn(),
      scrollToHighlightRects: vi.fn(),
    });
  });

  it("keeps the current page input editable while the user is typing", () => {
    render(<PageNavigator />);

    const input = screen.getByLabelText("current-page-input");
    fireEvent.change(input, { target: { value: "7" } });

    expect((input as HTMLInputElement).value).toBe("7");
  });
});
