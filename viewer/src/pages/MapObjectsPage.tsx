import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowDownUp } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { DataState } from "../components/DataState";
import { Stat } from "../components/Stat";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "../components/ui/panel";
import { useRepoJson } from "../lib/data-client";
import type { ObjectRecord, ObjectShadowCandidate } from "../lib/types";
import { cn, formatNumber } from "../lib/utils";

export function MapObjectsPage() {
  const candidates = useRepoJson<ObjectShadowCandidate[]>("extractor/ida/data/resource_hints/objs_shadow_candidates.json");
  const records = useRepoJson<ObjectRecord[]>("extracted/maps/candidates/objs_active_records.json");
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedType, setSelectedType] = useState<number | null>(null);

  const rows = candidates.data ?? [];
  const selectedCandidate = rows.find((row) => row.object_type === selectedType) ?? rows[0] ?? null;
  const selectedObjectType = selectedCandidate?.object_type ?? null;
  const objectRecords = records.data ?? [];
  const selectedRecords = selectedObjectType === null ? [] : objectRecords.filter((row) => row.object_type === selectedObjectType);

  const columns = useMemo<ColumnDef<ObjectShadowCandidate>[]>(
    () => [
      {
        accessorKey: "object_type",
        header: ({ column }) => (
          <SortButton onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>type</SortButton>
        ),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.object_type}</span>
      },
      {
        accessorKey: "candidate_shadow_name",
        header: "candidate",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.candidate_shadow_name}</span>
      },
      {
        accessorKey: "record_count",
        header: ({ column }) => (
          <SortButton onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>records</SortButton>
        ),
        cell: ({ row }) => formatNumber(row.original.record_count)
      },
      {
        accessorKey: "groups",
        header: "groups",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.groups}</span>
      },
      {
        accessorKey: "rotations",
        header: "rotations",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.rotations}</span>
      }
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="workbench-title">地图对象</h1>
        <p className="workbench-subtitle">
          按游戏地图上的 object_type 浏览实例分布，并把 IDA 导出的 shadow 名称作为候选标签。
        </p>
      </div>

      <DataState
        error={candidates.error ?? records.error}
        isLoading={candidates.isLoading || records.isLoading}
        label="地图对象"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="候选类型" value={rows.length} detail="有 shadow 名称的 object_type" />
        <Stat label="地图对象实例" value={objectRecords.length} detail="active object records" />
        <Stat label="当前类型实例" value={selectedRecords.length} detail={selectedCandidate?.candidate_shadow_name ?? "-"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel className="overflow-hidden">
          <PanelHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <PanelTitle>对象类型</PanelTitle>
              <PanelDescription>选择一行后右侧显示该类型的空间分布。</PanelDescription>
            </div>
            <Input
              className="w-full md:w-72"
              placeholder="filter type / shadow / group"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
            />
          </PanelHeader>
          <PanelContent className="p-0">
            <div className="max-h-[620px] overflow-auto">
              <table className="table-dense">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "cursor-pointer hover:bg-accent/60",
                        row.original.object_type === selectedObjectType && "bg-accent"
                      )}
                      onClick={() => setSelectedType(row.original.object_type)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelContent>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <PanelTitle>空间分布</PanelTitle>
                  <PanelDescription>
                    {selectedCandidate
                      ? `object_type ${selectedCandidate.object_type} / ${selectedCandidate.candidate_shadow_name}`
                      : "选择对象类型"}
                  </PanelDescription>
                </div>
                {selectedCandidate ? <Badge variant="outline">{selectedCandidate.candidate_basis}</Badge> : null}
              </div>
            </PanelHeader>
            <PanelContent className="space-y-4">
              <ObjectScatter records={objectRecords} selectedType={selectedObjectType} />
              {selectedCandidate ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Detail label="x range" value={`${selectedCandidate.x_min} - ${selectedCandidate.x_max}`} />
                  <Detail label="y range" value={`${selectedCandidate.y_min} - ${selectedCandidate.y_max}`} />
                  <Detail label="groups" value={selectedCandidate.groups} />
                  <Detail label="rotations" value={selectedCandidate.rotations} />
                </div>
              ) : null}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>实例记录</PanelTitle>
              <PanelDescription>当前类型的坐标和原始记录。</PanelDescription>
            </PanelHeader>
            <PanelContent className="p-0">
              <div className="max-h-[260px] overflow-auto">
                <table className="table-dense">
                  <thead>
                    <tr>
                      <th>idx</th>
                      <th>group</th>
                      <th>x,y</th>
                      <th>raw</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRecords.slice(0, 100).map((record) => (
                      <tr key={`${record.entry}-${record.record_index}`}>
                        <td className="mono-cell">{record.record_index}</td>
                        <td className="mono-cell">{record.group}</td>
                        <td className="mono-cell">
                          {record.x},{record.y}
                        </td>
                        <td className="mono-cell">{record.raw_hex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelContent>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SortButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={onClick} type="button">
      {children}
      <ArrowDownUp className="h-3 w-3" />
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-mono text-[11px]">{value}</div>
    </div>
  );
}

function ObjectScatter({ records, selectedType }: { records: ObjectRecord[]; selectedType: number | null }) {
  const bounds = useMemo(() => {
    if (records.length === 0) {
      return { minX: 0, maxX: 500, minY: 0, maxY: 500 };
    }

    return {
      minX: Math.min(...records.map((record) => record.x)),
      maxX: Math.max(...records.map((record) => record.x)),
      minY: Math.min(...records.map((record) => record.y)),
      maxY: Math.max(...records.map((record) => record.y))
    };
  }, [records]);

  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const points = selectedType === null ? records : records.filter((record) => record.object_type === selectedType);

  const scaleX = (x: number) => ((x - bounds.minX) / width) * 360 + 20;
  const scaleY = (y: number) => ((y - bounds.minY) / height) * 280 + 20;

  return (
    <svg viewBox="0 0 400 320" className="h-[320px] w-full rounded-md border bg-background">
      <rect x="20" y="20" width="360" height="280" fill="hsl(var(--muted))" opacity="0.45" />
      {records.slice(0, 900).map((record) => (
        <circle
          key={`bg-${record.entry}-${record.record_index}`}
          cx={scaleX(record.x)}
          cy={scaleY(record.y)}
          r="1.5"
          fill="hsl(var(--muted-foreground))"
          opacity="0.22"
        />
      ))}
      {points.map((record) => (
        <circle
          key={`${record.entry}-${record.record_index}`}
          cx={scaleX(record.x)}
          cy={scaleY(record.y)}
          r="4"
          fill="hsl(var(--primary))"
          opacity="0.86"
        >
          <title>{`type ${record.object_type} / group ${record.group} / ${record.x},${record.y}`}</title>
        </circle>
      ))}
      <text x="20" y="314" className="fill-muted-foreground text-[10px]">
        x {bounds.minX}-{bounds.maxX}, y {bounds.minY}-{bounds.maxY}
      </text>
    </svg>
  );
}
