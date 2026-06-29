import { Boxes, Image, Layers, UserSquare2 } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { DataState } from "../components/DataState";
import { ImageLightbox, type LightboxImage } from "../components/ImageLightbox";
import { Stat } from "../components/Stat";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "../components/ui/panel";
import { Select } from "../components/ui/select";
import { repoFile, useRepoJson } from "../lib/data-client";
import type { AimgRecord, FaceRecord, ModelRecord, WftxImageRecord } from "../lib/types";
import { cn, formatNumber, shortSource } from "../lib/utils";

type AssetMode = "faces" | "textures" | "models" | "aimg";

const aimgOverlaySamples = [
  "extracted/aimg/overlays/aimg_02196_on_2189.png",
  "extracted/aimg/overlays/aimg_02197_on_2193.png",
  "extracted/aimg/overlays/aimg_02198_on_2195_layer02_03_h.png",
  "extracted/aimg/overlays/aimg_02200_on_2195_layer06_07_h.png",
  "extracted/aimg/overlays/aimg_02204_on_2193_2194_h.png",
  "extracted/aimg/overlays/aimg_02205_on_2195_layer00_01_h.png"
];

export function AssetsPage() {
  const faces = useRepoJson<FaceRecord[]>("extracted/manifests/face_manifest.json");
  const textures = useRepoJson<WftxImageRecord[]>("extracted/manifests/resource_wftx_images.json");
  const pkModels = useRepoJson<ModelRecord[]>("extracted/manifests/model_wkmd_pkres.json");
  const res1Models = useRepoJson<ModelRecord[]>("extracted/manifests/model_wkmd_res1.json");
  const aimg = useRepoJson<AimgRecord[]>("extracted/manifests/aimg_records.json");
  const [mode, setMode] = useState<AssetMode>("faces");

  const models = useMemo(() => [...(pkModels.data ?? []), ...(res1Models.data ?? [])], [pkModels.data, res1Models.data]);
  const assetError = faces.error ?? textures.error ?? pkModels.error ?? res1Models.error ?? aimg.error;
  const assetLoading = faces.isLoading || textures.isLoading || pkModels.isLoading || res1Models.isLoading || aimg.isLoading;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="workbench-title">资产库</h1>
        <p className="workbench-subtitle">按游戏内容浏览头像、贴图、模型和地图覆盖层，不直接访问原始资源包。</p>
      </div>

      <DataState error={assetError} isLoading={assetLoading} label="资产索引" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="头像" value={faces.data?.length} detail="FCE 输出图像" />
        <Stat label="WFTX 图像" value={textures.data?.length} detail="资源包贴图" />
        <Stat label="WKMD 模型" value={models.length} detail="OBJ 可视化候选" />
        <Stat label="AIMG 记录" value={aimg.data?.length} detail="地图覆盖坐标" />
      </div>

      <Panel>
        <PanelHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <PanelTitle>内容类型</PanelTitle>
            <PanelDescription>头像、贴图、模型和地图覆盖层。</PanelDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <ModeButton icon={<UserSquare2 className="h-4 w-4" />} label="头像" mode="faces" active={mode} setMode={setMode} />
            <ModeButton icon={<Image className="h-4 w-4" />} label="贴图" mode="textures" active={mode} setMode={setMode} />
            <ModeButton icon={<Boxes className="h-4 w-4" />} label="模型" mode="models" active={mode} setMode={setMode} />
            <ModeButton icon={<Layers className="h-4 w-4" />} label="AIMG" mode="aimg" active={mode} setMode={setMode} />
          </div>
        </PanelHeader>
        <PanelContent>
          {mode === "faces" ? <FacesView faces={faces.data ?? []} /> : null}
          {mode === "textures" ? <TexturesView textures={textures.data ?? []} /> : null}
          {mode === "models" ? <ModelsView models={models} /> : null}
          {mode === "aimg" ? <AimgView records={aimg.data ?? []} /> : null}
        </PanelContent>
      </Panel>
    </div>
  );
}

function ModeButton({
  active,
  icon,
  label,
  mode,
  setMode
}: {
  active: AssetMode;
  icon: React.ReactNode;
  label: string;
  mode: AssetMode;
  setMode: (mode: AssetMode) => void;
}) {
  return (
    <Button variant={active === mode ? "default" : "outline"} size="sm" onClick={() => setMode(mode)}>
      {icon}
      {label}
    </Button>
  );
}

function FacesView({ faces }: { faces: FaceRecord[] }) {
  const [pageSize, setPageSize] = useState(80);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(faces.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const visibleFaces = faces.slice(start, start + pageSize);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxImages = useMemo<LightboxImage[]>(
    () =>
      visibleFaces.map((face) => ({
        src: repoFile(`extracted/faces/output/${face.output}`),
        title: `Face #${String(face.index).padStart(4, "0")}`,
        detail: `${face.width}x${face.height} / ${face.bpp}bpp / ${face.output}`
      })),
    [visibleFaces]
  );
  const safeSelectedIndex = Math.min(selectedIndex, Math.max(0, lightboxImages.length - 1));
  const selectedImage = lightboxImages[safeSelectedIndex] ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {formatNumber(start + 1)} - {formatNumber(Math.min(start + pageSize, faces.length))} / {formatNumber(faces.length)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            >
              <option value="40">40 / page</option>
              <option value="80">80 / page</option>
              <option value="160">160 / page</option>
              <option value="320">320 / page</option>
            </Select>
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(0)}>
              首页
            </Button>
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>
              上页
            </Button>
            <Badge variant="outline">
              {safePage + 1} / {pageCount}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
            >
              下页
            </Button>
            <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>
              末页
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8 xl:grid-cols-10">
          {visibleFaces.map((face, index) => (
            <button
              key={face.index}
              type="button"
              className={cn(
                "overflow-hidden rounded-md border bg-background text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === safeSelectedIndex && "border-primary ring-1 ring-primary"
              )}
              onClick={() => setSelectedIndex(index)}
            >
              <img
                src={lightboxImages[index].src}
                alt={`face ${face.index}`}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <figcaption className="border-t px-2 py-1 font-mono text-[11px] text-muted-foreground">
                #{String(face.index).padStart(4, "0")}
              </figcaption>
            </button>
          ))}
        </div>
      </div>
      <AssetImageAside
        title="头像"
        image={selectedImage}
        imageIndex={safeSelectedIndex}
        imageCount={lightboxImages.length}
        onOpen={() => setLightboxIndex(safeSelectedIndex)}
        lines={[
          `${formatNumber(faces.length)} records`,
          `${formatNumber(pageCount)} pages`,
          "输出来自 FCE 提取层",
          "后续可接武将表，把头像 index 映射到人物"
        ]}
      />
      <ImageLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

function TexturesView({ textures }: { textures: WftxImageRecord[] }) {
  const [sourceFilter, setSourceFilter] = useState("non-face");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const visibleTextures = useMemo(() => {
    return textures.filter((texture) => {
      const source = texture.source ?? "";
      if (sourceFilter === "non-face") {
        return !source.includes("/face/");
      }
      if (sourceFilter === "container") {
        return source.includes("/media/san11");
      }
      if (sourceFilter === "ui") {
        return source.includes("/media/ui/");
      }
      if (sourceFilter === "face") {
        return source.includes("/face/");
      }

      return true;
    });
  }, [sourceFilter, textures]);

  const groups = useMemo(() => {
    const grouped = new Map<string, { id: string; source: string; width: number; height: number; bpp: number; rows: WftxImageRecord[] }>();

    for (const texture of visibleTextures) {
      const source = shortSource(texture.source);
      const id = `${source}|${texture.width}|${texture.height}|${texture.bpp}`;
      const existing = grouped.get(id);
      if (existing) {
        existing.rows.push(texture);
      } else {
        grouped.set(id, {
          id,
          source,
          width: texture.width,
          height: texture.height,
          bpp: texture.bpp,
          rows: [texture]
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.rows.length - a.rows.length);
  }, [visibleTextures]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const samples = (selectedGroup?.rows ?? [])
    .filter((row) => row.output && row.width <= 1024 && row.height <= 1024)
    .slice(0, 48);
  const nonFaceCount = textures.filter((texture) => !(texture.source ?? "").includes("/face/")).length;
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxImages = useMemo<LightboxImage[]>(
    () =>
      samples.map((texture) => ({
        src: repoFile(`extracted/resources/output/${texture.output}`),
        title: `WFTX #${texture.index}`,
        detail: `${shortSource(texture.source)} / ${texture.width}x${texture.height} / ${texture.bpp}bpp`
      })),
    [samples]
  );
  const safeSelectedSampleIndex = Math.min(selectedSampleIndex, Math.max(0, lightboxImages.length - 1));
  const selectedTextureImage = lightboxImages[safeSelectedSampleIndex] ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="grid gap-4 2xl:grid-cols-[420px_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
            <div>
              <div className="text-sm font-medium">WFTX 分组</div>
              <div className="mt-1 text-xs text-muted-foreground">按来源、尺寸和 bpp 聚合。</div>
            </div>
            <Select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="non-face">排除头像</option>
              <option value="container">资源包</option>
              <option value="ui">UI 文件</option>
              <option value="face">头像来源</option>
              <option value="all">全部</option>
            </Select>
          </div>
          <div className="max-h-[560px] overflow-auto rounded-md border">
            <table className="table-dense">
              <thead>
                <tr>
                  <th>source</th>
                  <th>size</th>
                  <th>bpp</th>
                  <th>count</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr
                    key={group.id}
                    className={group.id === selectedGroup?.id ? "bg-accent" : "cursor-pointer hover:bg-accent/60"}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    <td className="mono-cell">{group.source}</td>
                    <td className="mono-cell">
                      {group.width}x{group.height}
                    </td>
                    <td className="mono-cell">{group.bpp}</td>
                    <td>{formatNumber(group.rows.length)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3">
            <div>
              <div className="font-mono text-sm">{selectedGroup ? selectedGroup.source : "-"}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selectedGroup
                  ? `${selectedGroup.width}x${selectedGroup.height} / ${selectedGroup.bpp}bpp / ${formatNumber(selectedGroup.rows.length)} records`
                  : "无可用贴图"}
              </div>
            </div>
            <Badge variant="outline">{formatNumber(samples.length)} samples</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {samples.map((texture, index) => (
              <button
                key={`${texture.output}-${index}`}
                type="button"
                className={cn(
                  "overflow-hidden rounded-md border bg-background text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  index === safeSelectedSampleIndex && "border-primary ring-1 ring-primary"
                )}
                onClick={() => setSelectedSampleIndex(index)}
              >
                <div className="flex aspect-square w-full items-center justify-center bg-muted/40 p-2">
                  <img
                    src={lightboxImages[index].src}
                    alt={`texture ${texture.index}`}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <figcaption className="truncate border-t px-2 py-1 font-mono text-[11px] text-muted-foreground">
                  #{texture.index} {texture.width}x{texture.height}
                </figcaption>
              </button>
            ))}
          </div>
        </div>
      </div>
      <AssetImageAside
        title="WFTX 贴图"
        image={selectedTextureImage}
        imageIndex={safeSelectedSampleIndex}
        imageCount={lightboxImages.length}
        onOpen={() => setLightboxIndex(safeSelectedSampleIndex)}
        lines={[
          `${formatNumber(textures.length)} records`,
          `${formatNumber(nonFaceCount)} non-face records`,
          `${formatNumber(groups.length)} visible groups`,
          "头像来源默认排除，避免和头像页重复"
        ]}
      />
      <ImageLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

function ModelsView({ models }: { models: ModelRecord[] }) {
  return (
    <div className="max-h-[650px] overflow-auto rounded-md border">
      <table className="table-dense">
        <thead>
          <tr>
            <th>entry</th>
            <th>source</th>
            <th>vertices</th>
            <th>triangles</th>
            <th>bbox</th>
            <th>obj</th>
          </tr>
        </thead>
        <tbody>
          {models.slice(0, 300).map((model) => (
            <tr key={`${model.source}-${model.entry}`}>
              <td className="mono-cell">{model.entry}</td>
              <td className="mono-cell">{shortSource(model.source)}</td>
              <td>{formatNumber(model.vertex_count)}</td>
              <td>{formatNumber(model.triangle_count)}</td>
              <td className="mono-cell">
                {model.bbox_min_x.toFixed(1)},{model.bbox_min_y.toFixed(1)},{model.bbox_min_z.toFixed(1)}
                {" -> "}
                {model.bbox_max_x.toFixed(1)},{model.bbox_max_y.toFixed(1)},{model.bbox_max_z.toFixed(1)}
              </td>
              <td className="mono-cell">{model.obj}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AimgView({ records }: { records: AimgRecord[] }) {
  const entries = new Set(records.map((record) => record.entry));
  const groups = new Set(records.map((record) => record.group));
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
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
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
      <AssetImageAside
        title="AIMG 覆盖"
        image={selectedImage}
        imageIndex={selectedIndex}
        imageCount={lightboxImages.length}
        onOpen={() => setLightboxIndex(selectedIndex)}
        lines={[
          `${formatNumber(records.length)} records`,
          `${formatNumber(entries.size)} entries`,
          `${formatNumber(groups.size)} groups`
        ]}
      />
      <ImageLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

function AssetImageAside({
  image,
  imageCount,
  imageIndex,
  lines,
  onOpen,
  title
}: {
  image: LightboxImage | null;
  imageCount: number;
  imageIndex: number;
  lines: string[];
  onOpen: () => void;
  title: string;
}) {
  return (
    <aside className="rounded-md border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        <Badge variant="outline">
          {imageCount > 0 ? `${imageIndex + 1} / ${imageCount}` : "local"}
        </Badge>
      </div>
      <button
        type="button"
        className="mt-3 flex aspect-square w-full cursor-zoom-in items-center justify-center rounded-md border bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60"
        onClick={onOpen}
        disabled={!image}
        aria-label={image ? `打开 ${image.title}` : "无可用图片"}
      >
        {image ? <img src={image.src} alt={image.title} className="max-h-full max-w-full object-contain" /> : null}
      </button>
      {image?.detail ? <div className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{image.detail}</div> : null}
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </aside>
  );
}
