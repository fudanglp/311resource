import { formatNumber } from "../lib/utils";

export function Stat({
  label,
  value,
  detail
}: {
  label: string;
  value: number | string | null | undefined;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-normal">
        {typeof value === "number" ? formatNumber(value) : value ?? "-"}
      </div>
      {detail ? <div className="mt-1 text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
