import { DataState } from "../components/DataState";
import { Stat } from "../components/Stat";
import { Badge } from "../components/ui/badge";
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "../components/ui/panel";
import { useRepoJson } from "../lib/data-client";
import type { CoverageSummary, SignatureSummary, StructCatalogField } from "../lib/types";
import { formatNumber, formatPercent, shortSource } from "../lib/utils";

export function DebugPage() {
  const coverage = useRepoJson<CoverageSummary[]>("extracted/manifests/resource_coverage_summary.json");
  const signatures = useRepoJson<SignatureSummary[]>("extracted/manifests/resource_signature_summary.json");
  const persons = useRepoJson<StructCatalogField[]>("extractor/ida/data/resource_hints/person_struct_catalog.json");
  const skills = useRepoJson<StructCatalogField[]>("extractor/ida/data/resource_hints/skill_struct_catalog.json");

  const error = coverage.error ?? signatures.error ?? persons.error ?? skills.error;
  const isLoading = coverage.isLoading || signatures.isLoading || persons.isLoading || skills.isLoading;
  const parsedBytes = (coverage.data ?? []).reduce((sum, row) => sum + row.parsed_entries, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="workbench-title">解析线索</h1>
        <p className="workbench-subtitle">
          这里保留技术来源、覆盖率和结构字段，用于支持主内容页；它不是用户浏览游戏内容的主入口。
        </p>
      </div>

      <DataState error={error} isLoading={isLoading} label="解析线索" />

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="容器" value={coverage.data?.length} />
        <Stat label="签名类型" value={signatures.data?.length} />
        <Stat label="parsed entries" value={parsedBytes} />
        <Stat label="结构字段" value={(persons.data?.length ?? 0) + (skills.data?.length ?? 0)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>资源覆盖</PanelTitle>
            <PanelDescription>提取层对资源容器的整体覆盖。</PanelDescription>
          </PanelHeader>
          <PanelContent className="p-0">
            <table className="table-dense">
              <thead>
                <tr>
                  <th>source</th>
                  <th>entries</th>
                  <th>parsed</th>
                  <th>recognized</th>
                  <th>raw</th>
                </tr>
              </thead>
              <tbody>
                {(coverage.data ?? []).map((row) => (
                  <tr key={row.source}>
                    <td className="mono-cell">{shortSource(row.source)}</td>
                    <td>{formatNumber(row.entry_count)}</td>
                    <td>{formatPercent(row.parsed_payload_ratio)}</td>
                    <td>{formatPercent(row.recognized_payload_ratio)}</td>
                    <td>{formatNumber(row.raw_entries)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>资源签名</PanelTitle>
            <PanelDescription>按签名聚合，帮助发现还没命名的内容类型。</PanelDescription>
          </PanelHeader>
          <PanelContent className="p-0">
            <div className="max-h-[420px] overflow-auto">
              <table className="table-dense">
                <thead>
                  <tr>
                    <th>signature</th>
                    <th>status</th>
                    <th>entries</th>
                    <th>ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {(signatures.data ?? []).slice(0, 80).map((row) => (
                    <tr key={`${row.source}-${row.signature_hex}`}>
                      <td className="mono-cell">{row.signature_text || row.signature_hex}</td>
                      <td>
                        <Badge variant={row.status === "parsed" ? "secondary" : "outline"}>{row.status}</Badge>
                      </td>
                      <td>{formatNumber(row.entry_count)}</td>
                      <td>{formatPercent(row.payload_ratio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelContent>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StructPanel title="武将结构字段" rows={persons.data ?? []} />
        <StructPanel title="特技结构字段" rows={skills.data ?? []} />
      </div>
    </div>
  );
}

function StructPanel({ rows, title }: { rows: StructCatalogField[]; title: string }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        <PanelDescription>后续把内容页接到具体数据表时使用。</PanelDescription>
      </PanelHeader>
      <PanelContent className="p-0">
        <div className="max-h-[360px] overflow-auto">
          <table className="table-dense">
            <thead>
              <tr>
                <th>offset</th>
                <th>field</th>
                <th>label</th>
                <th>comment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.struct}-${row.offset}-${row.field}`}>
                  <td className="mono-cell">{row.offset}</td>
                  <td className="mono-cell">{row.field}</td>
                  <td>{row.label || "-"}</td>
                  <td className="text-xs text-muted-foreground">{row.repeatable_comment || row.comment || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelContent>
    </Panel>
  );
}
