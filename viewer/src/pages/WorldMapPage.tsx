import { useEffect, useMemo, useState } from "react";
import { DataState } from "../components/DataState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "../components/ui/panel";
import { Select } from "../components/ui/select";
import { repoFile, useRepoJson, useRepoText } from "../lib/data-client";
import type { MapGridMember, ShexField } from "../lib/types";
import { formatNumber, shortSource, unique } from "../lib/utils";

type MapLayer = {
  id: string;
  label: string;
  imagePath: string;
  field?: ShexField;
};

const previewNames = [
  ["preview_b00_b01_b04.png", "地形+高度+通行"],
  ["preview_b00_b04_b09.png", "地形+通行+区域"],
  ["preview_staggered_b00_b01_b04.png", "错位预览"]
] as const;

export function WorldMapPage() {
  const fields = useRepoJson<ShexField[]>("extracted/maps/output/shex_fields.json");
  const gridMembers = useRepoJson<MapGridMember[]>("extractor/ida/data/resource_hints/map_grid_runtime_members.json");
  const notes = useRepoText("extractor/ida/data/resource_hints/map_grid_shex_notes.md");
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState("field-0");

  const maps = useMemo(() => {
    const rows = fields.data ?? [];
    return unique(rows.map((row) => row.entry)).map((entry) => {
      const entryRows = rows.filter((row) => row.entry === entry).sort((a, b) => a.field - b.field);
      const baseDir = entryRows[0]?.image.split("/").slice(0, -1).join("/") ?? "";
      return { entry, source: entryRows[0]?.source ?? "", baseDir, fields: entryRows };
    });
  }, [fields.data]);

  useEffect(() => {
    if (selectedEntry === null && maps.length > 0) {
      setSelectedEntry(maps[0].entry);
    }
  }, [maps, selectedEntry]);

  const selectedMap = maps.find((map) => map.entry === selectedEntry) ?? maps[0];
  const layers: MapLayer[] = selectedMap
    ? [
        ...previewNames.map(([file, label]) => ({
          id: file,
          label,
          imagePath: `extracted/maps/output/${selectedMap.baseDir}/${file}`
        })),
        ...selectedMap.fields.map((field) => ({
          id: `field-${field.field}`,
          label: `field_${String(field.field).padStart(2, "0")}`,
          imagePath: `extracted/maps/output/${field.image}`,
          field
        }))
      ]
    : [];
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? layers[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="workbench-title">世界地图</h1>
        <p className="workbench-subtitle">浏览 SHEX 地图字段、组合预览和已知 runtime map grid 成员。</p>
      </div>

      <DataState error={fields.error} isLoading={fields.isLoading} label="地图图层" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <PanelHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <PanelTitle>地图图层</PanelTitle>
              <PanelDescription>
                {selectedMap ? `${shortSource(selectedMap.source)} / entry ${selectedMap.entry}` : "无可用地图"}
              </PanelDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(selectedMap?.entry ?? "")}
                onChange={(event) => {
                  setSelectedEntry(Number(event.target.value));
                  setSelectedLayerId("preview_b00_b01_b04.png");
                }}
              >
                {maps.map((map) => (
                  <option key={map.entry} value={map.entry}>
                    entry {map.entry}
                  </option>
                ))}
              </Select>
              <Badge variant="outline">{formatNumber(selectedMap?.fields.length ?? 0)} fields</Badge>
            </div>
          </PanelHeader>
          <PanelContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {layers.map((layer) => (
                <Button
                  key={layer.id}
                  variant={layer.id === selectedLayer?.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLayerId(layer.id)}
                >
                  {layer.label}
                </Button>
              ))}
            </div>

            <div className="overflow-auto rounded-lg border bg-muted/30 p-3">
              {selectedLayer ? (
                <img
                  src={repoFile(selectedLayer.imagePath)}
                  alt={selectedLayer.label}
                  className="mx-auto max-h-[70vh] max-w-none rounded-md border bg-background"
                />
              ) : null}
            </div>

            {selectedLayer?.field ? (
              <div className="grid gap-3 md:grid-cols-4">
                <FieldStat label="min" value={selectedLayer.field.min_value} />
                <FieldStat label="max" value={selectedLayer.field.max_value} />
                <FieldStat label="unique" value={selectedLayer.field.unique_values} />
                <div className="rounded-md border bg-background p-3">
                  <div className="text-xs text-muted-foreground">top values</div>
                  <div className="mt-1 truncate font-mono text-xs" title={selectedLayer.field.top_values}>
                    {selectedLayer.field.top_values}
                  </div>
                </div>
              </div>
            ) : null}
          </PanelContent>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>runtime grid</PanelTitle>
              <PanelDescription>来自结构线索，只用于解释 SHEX 字段。</PanelDescription>
            </PanelHeader>
            <PanelContent>
              <DataState error={gridMembers.error} isLoading={gridMembers.isLoading} label="grid 成员" />
              <table className="table-dense">
                <thead>
                  <tr>
                    <th>offset</th>
                    <th>member</th>
                    <th>type</th>
                  </tr>
                </thead>
                <tbody>
                  {(gridMembers.data ?? []).map((member) => (
                    <tr key={member.offset}>
                      <td className="mono-cell">{member.offset}</td>
                      <td className="mono-cell">{member.member}</td>
                      <td className="mono-cell">{member.typeinfo_hex || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>SHEX 注释</PanelTitle>
              <PanelDescription>分析文档摘录，后续可转成字段标签。</PanelDescription>
            </PanelHeader>
            <PanelContent>
              <DataState error={notes.error} isLoading={notes.isLoading} label="SHEX 注释" />
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-3 text-xs leading-5">
                {notes.data}
              </pre>
            </PanelContent>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function FieldStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm">{formatNumber(value)}</div>
    </div>
  );
}
