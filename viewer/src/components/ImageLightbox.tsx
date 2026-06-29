import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./ui/button";

export type LightboxImage = {
  src: string;
  title: string;
  detail?: string;
};

export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange
}: {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  if (index === null || images.length === 0) {
    return null;
  }

  const safeIndex = Math.min(Math.max(index, 0), images.length - 1);
  const image = images[safeIndex];
  const hasPrevious = safeIndex > 0;
  const hasNext = safeIndex < images.length - 1;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft" && hasPrevious) {
        onIndexChange(safeIndex - 1);
      }

      if (event.key === "ArrowRight" && hasNext) {
        onIndexChange(safeIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasNext, hasPrevious, onClose, onIndexChange, safeIndex]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="flex min-h-14 items-center gap-3 border-b bg-card px-4" onClick={(event) => event.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{image.title}</div>
          {image.detail ? <div className="truncate text-xs text-muted-foreground">{image.detail}</div> : null}
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {safeIndex + 1} / {images.length}
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={image.src} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            原图
          </a>
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭图片查看器">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4" onClick={(event) => event.stopPropagation()}>
        <Button
          variant="outline"
          size="icon"
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2"
          disabled={!hasPrevious}
          onClick={() => onIndexChange(safeIndex - 1)}
          aria-label="上一张"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <img src={image.src} alt={image.title} className="max-h-full max-w-full object-contain" />

        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2"
          disabled={!hasNext}
          onClick={() => onIndexChange(safeIndex + 1)}
          aria-label="下一张"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
