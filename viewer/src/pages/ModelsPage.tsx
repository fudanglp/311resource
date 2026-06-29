import { lazy, Suspense, useMemo, useState } from "react";
import { DataState } from "../components/DataState";
import { Stat } from "../components/Stat";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "../components/ui/panel";
import { Select } from "../components/ui/select";
import { repoFile, useRepoJson } from "../lib/data-client";
import type { ModelRecord } from "../lib/types";
import { cn, formatNumber, shortSource } from "../lib/utils";

const ModelViewport = lazy(() =>
  import("../components/ModelViewport").then((module) => ({ default: module.ModelViewport }))
);

type SourceFilter = "all" | "pkres" | "res1";
type TextureFilter = "all" | "textured" | "untextured";
type GlbFilter = "all" | "with-glb" | "missing-glb";
type ComplexityFilter = "all" | "low" | "medium" | "high";

export function ModelsPage() {
  const pkModels = useRepoJson<ModelRecord[]>("extracted/manifests/model_wkmd_pkres.json");
  const res1Models = useRepoJson<ModelRecord[]>("extracted/manifests/model_wkmd_res1.json");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [textureFilter, setTextureFilter] = useState<TextureFilter>("all");
  const [glbFilter, setGlbFilter] = useState<GlbFilter>("all");
  const [complexityFilter, setComplexityFilter] = useState<ComplexityFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showAxes, setShowAxes] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [wireframe, setWireframe] = useState(false);

  const models = useMemo(() => [...(pkModels.data ?? []), ...(res1Models.data ?? [])], [pkModels.data, res1Models.data]);
  const texturedCount = models.filter(hasTexture).length;
  const glbCount = models.filter((model) => Boolean(model.glb)).length;
  const filteredModels = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return models.filter((model) => {
      if (sourceFilter === "pkres" && !model.source.includes("san11pkres")) {
        return false;
      }
      if (sourceFilter === "res1" && !model.source.includes("san11res1")) {
        return false;
      }
      if (textureFilter === "textured" && !hasTexture(model)) {
        return false;
      }
      if (textureFilter === "untextured" && hasTexture(model)) {
        return false;
      }
      if (glbFilter === "with-glb" && !model.glb) {
        return false;
      }
      if (glbFilter === "missing-glb" && model.glb) {
        return false;
      }
      if (complexityFilter !== "all" && modelComplexity(model) !== complexityFilter) {
        return false;
      }
      if (normalizedSearch) {
        const haystack = `${model.entry} ${model.source} ${model.obj} ${model.glb} ${model.texture}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      }
      return true;
    });
  }, [complexityFilter, glbFilter, models, search, sourceFilter, textureFilter]);

  const selectedModel =
    filteredModels.find((model) => modelKey(model) === selectedKey) ??
    filteredModels.find((model) => textureFilter === "all" && hasTexture(model)) ??
    filteredModels[0] ??
    null;
  const glbUrl = selectedModel?.glb ? repoFile(`${modelOutputRoot(selectedModel)}/${selectedModel.glb}`) : "";
  const textureUrl = selectedModel?.texture ? repoFile(`${modelOutputRoot(selectedModel)}/${selectedModel.texture}`) : "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="workbench-title">3D 模型</h1>
        <p className="workbench-subtitle">浏览 WKMD 导出的 GLB，按来源、贴图、复杂度和问题状态筛选。</p>
      </div>

      <DataState error={pkModels.error ?? res1Models.error} isLoading={pkModels.isLoading || res1Models.isLoading} label="模型索引" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="模型" value={models.length} detail={`${formatNumber(glbCount)} GLB`} />
        <Stat label="有贴图" value={texturedCount} detail={`${formatNumber(models.length - texturedCount)} untextured`} />
        <Stat label="当前筛选" value={filteredModels.length} />
        <Stat label="高复杂度" value={models.filter((model) => modelComplexity(model) === "high").length} detail="triangles >= 800" />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>筛选</PanelTitle>
          <PanelDescription>默认优先选中一个有贴图的模型，方便检查材质链路。</PanelDescription>
        </PanelHeader>
        <PanelContent className="grid gap-2 md:grid-cols-5">
          <Select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
            <option value="all">全部来源</option>
            <option value="pkres">san11pkres</option>
            <option value="res1">san11res1</option>
          </Select>
          <Select value={textureFilter} onChange={(event) => setTextureFilter(event.target.value as TextureFilter)}>
            <option value="all">全部贴图状态</option>
            <option value="textured">有贴图</option>
            <option value="untextured">无贴图</option>
          </Select>
          <Select value={glbFilter} onChange={(event) => setGlbFilter(event.target.value as GlbFilter)}>
            <option value="all">全部 GLB 状态</option>
            <option value="with-glb">有 GLB</option>
            <option value="missing-glb">缺 GLB</option>
          </Select>
          <Select value={complexityFilter} onChange={(event) => setComplexityFilter(event.target.value as ComplexityFilter)}>
            <option value="all">全部复杂度</option>
            <option value="low">low &lt; 200 tris</option>
            <option value="medium">medium 200-799</option>
            <option value="high">high &gt;= 800</option>
          </Select>
          <Input placeholder="entry / path / texture" value={search} onChange={(event) => setSearch(event.target.value)} />
        </PanelContent>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_480px]">
        <Panel className="overflow-hidden">
          <PanelHeader>
            <PanelTitle>WKMD 模型列表</PanelTitle>
            <PanelDescription>点击行切换右侧 WebGL 预览。</PanelDescription>
          </PanelHeader>
          <PanelContent className="p-0">
            <div className="max-h-[760px] overflow-auto">
              <table className="table-dense">
                <thead>
                  <tr>
                    <th>entry</th>
                    <th>source</th>
                    <th>texture</th>
                    <th>complexity</th>
                    <th>vertices</th>
                    <th>triangles</th>
                    <th>glb</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map((model) => (
                    <tr
                      key={modelKey(model)}
                      className={cn(
                        "cursor-pointer hover:bg-accent/60",
                        selectedModel && modelKey(model) === modelKey(selectedModel) && "bg-accent"
                      )}
                      onClick={() => setSelectedKey(modelKey(model))}
                    >
                      <td className="mono-cell">{model.entry}</td>
                      <td className="mono-cell">{shortSource(model.source)}</td>
                      <td>
                        <Badge variant={hasTexture(model) ? "secondary" : "outline"}>{hasTexture(model) ? "textured" : "none"}</Badge>
                      </td>
                      <td>
                        <Badge variant={modelComplexity(model) === "high" ? "default" : "outline"}>{modelComplexity(model)}</Badge>
                      </td>
                      <td>{formatNumber(model.vertex_count)}</td>
                      <td>{formatNumber(model.triangle_count)}</td>
                      <td className="mono-cell">{model.glb || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelContent>
        </Panel>

        <aside className="space-y-3 rounded-md border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">3D 预览</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {selectedModel ? `${shortSource(selectedModel.source)} / entry ${selectedModel.entry}` : "No model"}
              </div>
            </div>
            <Badge variant={hasTexture(selectedModel) ? "secondary" : "outline"}>
              {hasTexture(selectedModel) ? "textured" : "untextured"}
            </Badge>
          </div>

          {selectedModel && glbUrl ? (
            <Suspense
              fallback={
                <div className="flex h-[420px] items-center justify-center rounded-md border bg-background text-sm text-muted-foreground">
                  Loading WebGL viewer
                </div>
              }
            >
              <ModelViewport key={glbUrl} url={glbUrl} wireframe={wireframe} showGrid={showGrid} showAxes={showAxes} />
            </Suspense>
          ) : (
            <div className="flex h-[420px] items-center justify-center rounded-md border bg-background text-sm text-muted-foreground">
              No GLB for selected model
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <ToggleButton active={wireframe} label="Wireframe" onClick={() => setWireframe((value) => !value)} />
            <ToggleButton active={showGrid} label="Grid" onClick={() => setShowGrid((value) => !value)} />
            <ToggleButton active={showAxes} label="Axes" onClick={() => setShowAxes((value) => !value)} />
          </div>

          {textureUrl ? (
            <div className="rounded-md border bg-background p-3">
              <div className="mb-2 text-xs text-muted-foreground">texture preview</div>
              <div className="flex aspect-square items-center justify-center rounded-md bg-muted/40 p-2">
                <img src={textureUrl} alt={selectedModel?.texture} className="max-h-full max-w-full object-contain" />
              </div>
            </div>
          ) : null}

          {selectedModel ? (
            <div className="space-y-2 text-xs text-muted-foreground">
              <DetailRow label="vertices" value={formatNumber(selectedModel.vertex_count)} />
              <DetailRow label="triangles" value={formatNumber(selectedModel.triangle_count)} />
              <DetailRow
                label="bbox"
                value={`${selectedModel.bbox_min_x.toFixed(1)},${selectedModel.bbox_min_y.toFixed(1)},${selectedModel.bbox_min_z.toFixed(1)} -> ${selectedModel.bbox_max_x.toFixed(1)},${selectedModel.bbox_max_y.toFixed(1)},${selectedModel.bbox_max_z.toFixed(1)}`}
              />
              <DetailRow label="glb" value={selectedModel.glb || "-"} />
              <DetailRow label="obj" value={selectedModel.obj} />
              <DetailRow label="texture" value={selectedModel.texture || "-"} />
              <DetailRow label="note" value={selectedModel.note || "-"} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function hasTexture(model: ModelRecord | null) {
  return Boolean(model && (model.texture || model.texture_entry >= 0));
}

function modelKey(model: ModelRecord) {
  return `${model.source}:${model.entry}`;
}

function modelOutputRoot(model: ModelRecord) {
  return model.source.includes("san11res1") ? "extracted/models/output_res1" : "extracted/models/output_pkres";
}

function modelComplexity(model: ModelRecord): "low" | "medium" | "high" {
  if (model.triangle_count < 200) {
    return "low";
  }
  if (model.triangle_count < 800) {
    return "medium";
  }
  return "high";
}

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-[11px] text-foreground">{value}</div>
    </div>
  );
}
