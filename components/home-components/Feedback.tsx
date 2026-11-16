"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChevronDown, ImagePlus, MessageCircleHeart, X } from "lucide-react";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

const REASONS = [
  "Bug or technical issue",
  "Feature request",
  "Account or billing",
  "Other",
] as const;
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 1024 * 1024;
const MAX_DETAILS_LENGTH = 600;
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const formSchema = z.object({
  reason: z.string().min(1, "Please choose a reason."),
  details: z
    .string()
    .trim()
    .min(5, "Please provide at least 5 characters of detail.")
    .max(
      MAX_DETAILS_LENGTH,
      `Details must be ${MAX_DETAILS_LENGTH} characters or fewer.`,
    ),
});

type FeedbackImage = {
  file: File;
  previewUrl: string;
};

interface FeedbackProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export default function Feedback({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: FeedbackProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [images, setImages] = useState<FeedbackImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const previewUrls = useRef(new Set<string>());
  const isSelectingFiles = useRef(false);
  const filePickerResetTimer = useRef<number | null>(null);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: "",
      details: "",
    },
  });

  const resetFilePickerGuardAfterDelay = useCallback(() => {
    if (filePickerResetTimer.current !== null) {
      window.clearTimeout(filePickerResetTimer.current);
    }
    filePickerResetTimer.current = window.setTimeout(() => {
      isSelectingFiles.current = false;
      filePickerResetTimer.current = null;
    }, 1000);
  }, []);

  const fileInputRef = useCallback(
    (element: HTMLInputElement | null) => {
      element?.addEventListener("cancel", resetFilePickerGuardAfterDelay);
    },
    [resetFilePickerGuardAfterDelay],
  );

  useEffect(() => {
    const handleWindowFocus = () => {
      resetFilePickerGuardAfterDelay();
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      if (filePickerResetTimer.current !== null) {
        window.clearTimeout(filePickerResetTimer.current);
      }
    };
  }, [resetFilePickerGuardAfterDelay]);

  function addImages(files: File[]) {
    const nextImages = [...images];
    const errors: string[] = [];

    for (const file of files) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: use a JPG, PNG, GIF, or WebP image.`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name}: images must be 1 MB or smaller.`);
        continue;
      }
      if (nextImages.length >= MAX_IMAGES) {
        errors.push(`You can attach up to ${MAX_IMAGES} images.`);
        break;
      }

      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      nextImages.push({ file, previewUrl });
    }

    setImages(nextImages);
    setImageError(errors.length ? errors.join(" ") : null);
  }

  function removeImage(previewUrl: string) {
    URL.revokeObjectURL(previewUrl);
    previewUrls.current.delete(previewUrl);
    setImages((current) =>
      current.filter((image) => image.previewUrl !== previewUrl),
    );
    setImageError(null);
  }

  function clearImages() {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setImages([]);
    setImageError(null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    addImages(Array.from(event.dataTransfer.files));
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("reason", values.reason);
      formData.set("details", values.details);
      images.forEach(({ file }) => formData.append("images", file));

      const response = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof result?.error === "string"
            ? result.error
            : "Could not send feedback. Please try again.";
        throw new Error(message);
      }

      clearImages();
      form.reset();
      setSubmitted(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not send feedback. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isSelectingFiles.current) return;
        if (controlledOpen === undefined) setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
        if (!nextOpen) {
          clearImages();
          form.reset();
          setSubmitted(false);
        }
      }}
    >
      {showTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="SidebarMenuButton"
            className="group flex h-8 w-full min-w-0 items-center justify-start gap-0 px-2 text-sm font-normal text-foreground"
          >
            <MessageCircleHeart
              size="16"
              className="mr-2 h-4 w-4 text-muted-foreground"
            />
            Feedback
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-[650px] [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-[0.3rem] [&::-webkit-scrollbar-track]:bg-transparent"
        onFocusOutside={(event) => {
          if (isSelectingFiles.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isSelectingFiles.current) event.preventDefault();
        }}
      >
        <DialogTitle>Report a problem</DialogTitle>
        <DialogDescription className="sr-only">
          Tell us what went wrong and optionally attach up to four images.
        </DialogDescription>
        {submitted ? (
          <div className="py-6 text-center">
            <p className="font-medium text-green-600">
              Thank you. Your feedback has been sent.
            </p>
            <DialogFooter className="mt-6 justify-end">
              <DialogClose asChild>
                <Button type="button">Done</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Reason</FormLabel>
                    <DropdownMenu>
                      <FormControl>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="flex h-10 w-full justify-between app-radius-lg border border-border bg-background px-3 text-sm font-normal text-foreground hover:bg-muted/40"
                          >
                            <span
                              className={
                                field.value ? "" : "text-muted-foreground"
                              }
                            >
                              {field.value || "Select a reason"}
                            </span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                      </FormControl>
                      <DropdownMenuContent
                        align="start"
                        className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
                      >
                        <DropdownMenuRadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          {REASONS.map((reason) => (
                            <DropdownMenuRadioItem key={reason} value={reason}>
                              {reason}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      Please provide details
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={5}
                        maxLength={MAX_DETAILS_LENGTH}
                        placeholder="Tell us what is wrong"
                        className="[&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-[0.3rem] [&::-webkit-scrollbar-track]:bg-transparent"
                        {...field}
                      />
                    </FormControl>
                    <p
                      className={`text-right text-xs ${
                        MAX_DETAILS_LENGTH - field.value.length <= 50
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {MAX_DETAILS_LENGTH - field.value.length} characters
                      remaining
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label
                  htmlFor="feedback-images"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 app-radius-lg border-2 border-dashed px-4 py-5 text-center text-sm text-muted-foreground transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <ImagePlus className="h-5 w-5" />
                  <span>
                    Drop up to 4 images here
                    <br />
                    or click to choose
                  </span>
                  <span className="text-xs">
                    JPG, PNG, GIF, or WebP; up to 1 MB each
                  </span>
                  <input
                    ref={fileInputRef}
                    id="feedback-images"
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    multiple
                    disabled={loading || images.length >= MAX_IMAGES}
                    className="sr-only"
                    onClick={() => {
                      isSelectingFiles.current = true;
                    }}
                    onChange={(event) => {
                      addImages(Array.from(event.currentTarget.files ?? []));
                      event.currentTarget.value = "";
                      resetFilePickerGuardAfterDelay();
                    }}
                  />
                </label>
                {imageError && (
                  <p role="alert" className="text-sm text-destructive">
                    {imageError}
                  </p>
                )}
                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.map(({ file, previewUrl }) => (
                      <div
                        key={previewUrl}
                        className="relative aspect-square overflow-hidden app-radius-md border border-border"
                      >
                        <Image
                          src={previewUrl}
                          alt={file.name}
                          fill
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => removeImage(previewUrl)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center app-radius-full bg-background/90 text-foreground hover:bg-background"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 flex-row-reverse">
                <DialogClose asChild>
                  <Button type="button" variant="ghost" disabled={loading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={loading}>
                  {loading ? "Sending..." : "Send"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
