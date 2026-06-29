import { useMemo, useState } from "react";
import { DataState } from "../components/DataState";
import { ImageLightbox, type LightboxImage } from "../components/ImageLightbox";
import { Stat } from "../components/Stat";
import { Badge } from "../components/ui/badge";
import { repoFile, useRepoJson } from "../lib/data-client";
import type { AimgRecord } from "../lib/types";
import { cn, formatNumber } from "../lib/utils";

const aimgOverlaySamples = [
  "extracted/aimg/overlays/aimg_02196_on_2189.png",
  "extracted/aimg/overlays/aimg_02197_on_2193.png",
  "extracted/aimg/overlays/aimg_02198_on_2195_layer02_03_h.png",
  "extracted/aimg/overlays/aimg_02200_on_2195_layer06_07_h.png",
  "extracted/aimg/overlays/aimg_02204_on_2193_2194_h.png",
  "extracted/aimg/overlays/aimg_02205_on_2195_layer00_01_h.png"
];

export function AimgPage() {
  const aimg = useRepoJson<AimgRecord[]>("extracted/manifests/aimg_records.json");
  const records = aimg.data ?? [];
  const entries = new Set(records.map((record) => record.entry));
  const groups = new Set(records.map((record) => record.group));
  const frames = new Set(records.map((record) => record.frame));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxImages = useMemo<LightboxImage[]>(
    () =>
      aimgOverlaySamples.map((path) => ({
        src: repoFile(path),
        title: path.split("/").pop() ?? path,
        detail: path
      })),
    []
  );
  const selectedImage = lightboxImages[selectedIndex] ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="workbench-title">AIMG 覆盖层</h1>
        <p className="workbench-subtitle">浏览 AIMG overlay 样本和记录分布；后续可接地图页做坐标联动。</p>
      </div>

      <DataState error={aimg.error} isLoading={aimg.isLoading} label="AIMG 索引" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="AIMG records" value={records.length} />
        <Stat label="entries" value={entries.size} />
        <Stat label="groups" value={groups.size} />
        <Stat label="frames" value={frames.size} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {aimgOverlaySamples.map((path, index) => (
            <button
              key={path}
              type="button"
              className={cn(
                "overflow-hidden rounded-md border bg-background text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === selectedIndex && "border-primary ring-1 ring-primary"
              )}
              onClick={() => setSelectedIndex(index)}
            >
              <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted/40 p-2">
                <img src={lightboxImages[index].src} alt={path.split("/").pop()} className="max-h-full max-w-full object-contain" loading="lazy" />
              </div>
              <figcaption className="truncate border-t px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {path.split("/").pop()}
              </figcaption>
            </button>
          ))}
        </div>

        <aside className="rounded-md border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">AIMG overlay</div>
            <Badge variant="outline">
              {selectedIndex + 1} / {lightboxImages.length}
            </Badge>
          </div>
          <button
            type="button"
            className="mt-3 flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center rounded-md border bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setLightboxIndex(selectedIndex)}
          >
            {selectedImage ? <img src={selectedImage.src} alt={selectedImage.title} className="max-h-full max-w-full object-contain" /> : null}
          </button>
          {selectedImage?.detail ? <div className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{selectedImage.detail}</div> : null}
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>{formatNumber(records.length)} records</div>
            <div>{formatNumber(entries.size)} entries</div>
            <div>{formatNumber(groups.size)} groups</div>
          </div>
        </aside>
      </div>

      <ImageLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
