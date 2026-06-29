import { Link } from "@tanstack/react-router";
import { ArrowRight, Images, Map, Mountain } from "lucide-react";
import type React from "react";
import { DataState } from "../components/DataState";
import { Stat } from "../components/Stat";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "../components/ui/panel";
import { useRepoJson } from "../lib/data-client";
import type { CoverageSummary, ResourceHintSummary } from "../lib/types";
import { formatNumber, formatPercent, shortSource } from "../lib/utils";

export function OverviewPage() {
  const hints = useRepoJson<ResourceHintSummary>("extractor/ida/data/resource_hints/summary.json");
  const coverage = useRepoJson<CoverageSummary[]>("extracted/manifests/resource_coverage_summary.json");

  const coverageRows = coverage.data ?? [];
  const totalEntries = coverageRows.reduce((sum, row) => sum + row.entry_count, 0);
  const parsedEntries = coverageRows.reduce((sum, row) => sum + row.parsed_entries, 0);
  const rawEntries = coverageRows.reduce((sum, row) => sum + row.raw_entries, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="workbench-title">游戏内容工作台</h1>
        <p className="workbench-subtitle">
          从地图、对象和资产开始浏览已提取内容；结构体和 IDA 线索只作为解释来源，不作为主要入口。
        </p>
      </div>

      <DataState error={coverage.error ?? hints.error} isLoading={coverage.isLoading || hints.isLoading} label="概览数据" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="资源条目" value={totalEntries} detail={`${formatNumber(parsedEntries)} parsed`} />
        <Stat label="未识别条目" value={rawEntries} detail="用于后续补解析" />
        <Stat label="地图对象类型" value={hints.data?.objs_object_types} detail={`${hints.data?.objs_object_types_with_shadow_candidate ?? "-"} 有候选名`} />
        <Stat label="人物/特技字段" value={(hints.data?.person_catalog_fields ?? 0) + (hints.data?.skill_catalog_fields ?? 0)} detail="后续内容入口" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <PanelHeader>
            <PanelTitle>内容入口</PanelTitle>
            <PanelDescription>按游戏对象组织，不按提取目录组织。</PanelDescription>
          </PanelHeader>
          <PanelContent className="grid gap-3 md:grid-cols-3">
            <ContentLink
              icon={<Map className="h-4 w-4" />}
              title="世界地图"
              detail="SHEX 字段图层、组合预览、runtime grid 线索"
              to="/map"
            />
            <ContentLink
              icon={<Mountain className="h-4 w-4" />}
              title="地图对象"
              detail="object_type 分布、shadow 候选、坐标散点"
              to="/map/objects"
            />
            <ContentLink
              icon={<Images className="h-4 w-4" />}
              title="资产库"
              detail="头像、WFTX 贴图、模型、AIMG 覆盖"
              to="/assets"
            />
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>容器覆盖</PanelTitle>
            <PanelDescription>只展示统计，不暴露原始游戏文件。</PanelDescription>
          </PanelHeader>
          <PanelContent className="space-y-3">
            {coverageRows.map((row) => (
              <div key={row.source} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-xs">{shortSource(row.source)}</div>
                  <Badge variant="secondary">{formatPercent(row.parsed_payload_ratio)}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>{formatNumber(row.entry_count)} entries</span>
                  <span>{formatNumber(row.recognized_entries)} recognized</span>
                  <span>{formatNumber(row.raw_entries)} raw</span>
                </div>
              </div>
            ))}
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>当前解析重点</PanelTitle>
          <PanelDescription>这部分来自已提交的轻量索引，可帮助决定下一步资源解析。</PanelDescription>
        </PanelHeader>
        <PanelContent className="grid gap-3 md:grid-cols-4">
          <Stat label="shadow 名称" value={hints.data?.shadow_names} />
          <Stat label="map grid 成员" value={hints.data?.map_grid_runtime_members} />
          <Stat label="map grid 相关符号" value={hints.data?.map_grid_related_symbols} />
          <Stat label="skill 字段" value={hints.data?.skill_catalog_fields} />
        </PanelContent>
      </Panel>
    </div>
  );
}

function ContentLink({
  detail,
  icon,
  title,
  to
}: {
  detail: string;
  icon: React.ReactNode;
  title: string;
  to: "/" | "/map" | "/map/objects" | "/assets";
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">{detail}</p>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link to={to}>
          打开
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
